package com.ticketing.app

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.util.concurrent.Executor

@CapacitorPlugin(name = "SecureKey")
class SecureKeyPlugin : Plugin() {

    private val KEYSTORE_PROVIDER = "AndroidKeyStore"
    private val KEY_ALGORITHM = KeyProperties.KEY_ALGORITHM_EC
    private val SIGNATURE_ALGORITHM = "SHA256withECDSA"

    private lateinit var executor: Executor
    private lateinit var biometricPrompt: BiometricPrompt

    override fun load() {
        super.load()
        executor = ContextCompat.getMainExecutor(context)
    }

    @PluginMethod
    fun generateKeyPair(call: PluginCall) {
        val userId = call.getString("userId")
        val promptMessage = call.getString("promptMessage") ?: "Authenticate to create secure key"

        if (userId == null) {
            call.reject("userId is required")
            return
        }

        val keyAlias = "secure_key_$userId"

        try {
            // 이미 키가 존재하면 삭제
            val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
            keyStore.load(null)
            if (keyStore.containsAlias(keyAlias)) {
                keyStore.deleteEntry(keyAlias)
            }

            // 생체 인증 또는 기기 잠금(PIN/패턴/비밀번호) 확인
            val biometricManager = BiometricManager.from(context)
            var canProceed = false

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // Android 11+: BIOMETRIC_STRONG 또는 DEVICE_CREDENTIAL
                val authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG or
                                    BiometricManager.Authenticators.DEVICE_CREDENTIAL
                val canAuthenticate = biometricManager.canAuthenticate(authenticators)
                android.util.Log.d("SecureKeyPlugin", "generateKeyPair Android 11+ canAuthenticate: $canAuthenticate")

                when (canAuthenticate) {
                    BiometricManager.BIOMETRIC_SUCCESS -> {
                        canProceed = true
                    }
                    BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> {
                        call.reject("No biometric or device credential enrolled. Please set up a screen lock.")
                        return
                    }
                    else -> {
                        call.reject("Authentication not available")
                        return
                    }
                }
            } else {
                // Android 10 이하: BIOMETRIC_STRONG만 지원 (PIN만으로는 보안 키 생성 불가)
                val canAuthenticateBiometric = biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                android.util.Log.d("SecureKeyPlugin", "generateKeyPair Android 10- BIOMETRIC_STRONG: $canAuthenticateBiometric")

                if (canAuthenticateBiometric == BiometricManager.BIOMETRIC_SUCCESS) {
                    canProceed = true
                } else {
                    // Android 10 이하에서는 생체 인증이 필수
                    call.reject("Biometric authentication is required on Android 10 and below. Please enroll fingerprint or face recognition.")
                    return
                }
            }

            if (canProceed) {
                // BiometricPrompt는 메인 스레드에서 실행되어야 함
                activity.runOnUiThread {
                    authenticateAndGenerateKey(call, keyAlias, promptMessage)
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("SecureKeyPlugin", "generateKeyPair error", e)
            call.reject("Failed to generate key pair: ${e.message}", e)
        }
    }

    private fun authenticateAndGenerateKey(call: PluginCall, keyAlias: String, promptMessage: String) {
        val activity = activity as? FragmentActivity ?: run {
            call.reject("Activity is not a FragmentActivity")
            return
        }

        // Android 버전별로 다른 PromptInfo 빌드
        val promptInfoBuilder = BiometricPrompt.PromptInfo.Builder()
            .setTitle("인증 필요")
            .setSubtitle(promptMessage)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11+: BIOMETRIC_STRONG | DEVICE_CREDENTIAL 지원
            promptInfoBuilder.setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG or
                BiometricManager.Authenticators.DEVICE_CREDENTIAL
            )
        } else {
            // Android 10 이하: 생체 인증만 허용 (키 설정의 -1과 일치)
            promptInfoBuilder.setNegativeButtonText("취소")
        }

        val promptInfo = promptInfoBuilder.build()

        biometricPrompt = BiometricPrompt(activity, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    call.reject("Authentication error: $errString")
                }

                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    try {
                        val publicKey = doGenerateKeyPair(keyAlias)
                        val ret = JSObject()
                        ret.put("publicKey", publicKey)
                        call.resolve(ret)
                    } catch (e: Exception) {
                        call.reject("Failed to generate key: ${e.message}", e)
                    }
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    call.reject("Authentication failed")
                }
            })

        biometricPrompt.authenticate(promptInfo)
    }

    private fun doGenerateKeyPair(keyAlias: String): String {
        val keyPairGenerator = KeyPairGenerator.getInstance(
            KEY_ALGORITHM,
            KEYSTORE_PROVIDER
        )

        val parameterSpec = KeyGenParameterSpec.Builder(
            keyAlias,
            KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
        ).run {
            setDigests(KeyProperties.DIGEST_SHA256)
            setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1")) // P-256 curve
            setUserAuthenticationRequired(true) // 생체 인증 필수
            setInvalidatedByBiometricEnrollment(false) // 지문 재등록해도 키 유효

            // Android 11+ (API 30+)에서만 사용 가능
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // 생체 인증 또는 기기 잠금(PIN/패턴/비밀번호) 허용
                setUserAuthenticationParameters(
                    0, // 매번 인증
                    KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL
                )
            } else {
                @Suppress("DEPRECATION")
                setUserAuthenticationValidityDurationSeconds(-1) // 매번 인증
            }

            build()
        }

        keyPairGenerator.initialize(parameterSpec)
        val keyPair = keyPairGenerator.generateKeyPair()

        // 공개키를 Base64로 인코딩 (SPKI 형식)
        val publicKeyBytes = keyPair.public.encoded
        return Base64.encodeToString(publicKeyBytes, Base64.NO_WRAP)
    }

    @PluginMethod
    fun hasPrivateKey(call: PluginCall) {
        val userId = call.getString("userId")
        if (userId == null) {
            call.reject("userId is required")
            return
        }

        val keyAlias = "secure_key_$userId"

        try {
            val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
            keyStore.load(null)

            val exists = keyStore.containsAlias(keyAlias)
            val ret = JSObject()
            ret.put("exists", exists)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Failed to check key existence: ${e.message}", e)
        }
    }

    @PluginMethod
    fun signData(call: PluginCall) {
        val userId = call.getString("userId")
        val data = call.getString("data")
        val promptMessage = call.getString("promptMessage") ?: "Authenticate to sign"

        if (userId == null || data == null) {
            call.reject("userId and data are required")
            return
        }

        val keyAlias = "secure_key_$userId"

        try {
            val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
            keyStore.load(null)

            if (!keyStore.containsAlias(keyAlias)) {
                call.reject("Private key not found")
                return
            }

            // BiometricPrompt는 메인 스레드에서 실행되어야 함
            activity.runOnUiThread {
                authenticateAndSign(call, keyAlias, data, promptMessage)
            }
        } catch (e: Exception) {
            call.reject("Failed to sign data: ${e.message}", e)
        }
    }

    private fun authenticateAndSign(call: PluginCall, keyAlias: String, data: String, promptMessage: String) {
        val activity = activity as? FragmentActivity ?: run {
            call.reject("Activity is not a FragmentActivity")
            return
        }

        try {
            // Signature 객체 초기화 (Android 10 이하에서 CryptoObject 필요)
            val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
            keyStore.load(null)
            val privateKey = keyStore.getKey(keyAlias, null) as java.security.PrivateKey

            val signature = Signature.getInstance(SIGNATURE_ALGORITHM)
            signature.initSign(privateKey)

            // Android 버전별로 다른 PromptInfo 빌드
            val promptInfoBuilder = BiometricPrompt.PromptInfo.Builder()
                .setTitle("인증 필요")
                .setSubtitle(promptMessage)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // Android 11+: BIOMETRIC_STRONG | DEVICE_CREDENTIAL 지원
                promptInfoBuilder.setAllowedAuthenticators(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG or
                    BiometricManager.Authenticators.DEVICE_CREDENTIAL
                )
            } else {
                // Android 10 이하: 생체 인증만 허용 (키 설정의 -1과 일치)
                promptInfoBuilder.setNegativeButtonText("취소")
            }

            val promptInfo = promptInfoBuilder.build()

            biometricPrompt = BiometricPrompt(activity, executor,
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        super.onAuthenticationError(errorCode, errString)
                        call.reject("Authentication error: $errString")
                    }

                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        super.onAuthenticationSucceeded(result)
                        try {
                            // 인증된 signature 객체로 서명
                            val authenticatedSignature = result.cryptoObject?.signature ?: signature
                            authenticatedSignature.update(data.toByteArray(Charsets.UTF_8))
                            val signatureBytes = authenticatedSignature.sign()

                            val ret = JSObject()
                            ret.put("signature", Base64.encodeToString(signatureBytes, Base64.NO_WRAP))
                            call.resolve(ret)
                        } catch (e: Exception) {
                            call.reject("Failed to sign: ${e.message}", e)
                        }
                    }

                    override fun onAuthenticationFailed() {
                        super.onAuthenticationFailed()
                        call.reject("Authentication failed")
                    }
                })

            // Android 10 이하에서는 CryptoObject 전달 필수
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
                val cryptoObject = BiometricPrompt.CryptoObject(signature)
                biometricPrompt.authenticate(promptInfo, cryptoObject)
            } else {
                biometricPrompt.authenticate(promptInfo)
            }
        } catch (e: Exception) {
            call.reject("Failed to initialize signature: ${e.message}", e)
        }
    }

    @PluginMethod
    fun getPublicKey(call: PluginCall) {
        val userId = call.getString("userId")
        if (userId == null) {
            call.reject("userId is required")
            return
        }

        val keyAlias = "secure_key_$userId"

        try {
            val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
            keyStore.load(null)

            val ret = JSObject()
            if (keyStore.containsAlias(keyAlias)) {
                val publicKey = keyStore.getCertificate(keyAlias)?.publicKey
                    ?: keyStore.getEntry(keyAlias, null)?.let {
                        (it as KeyStore.PrivateKeyEntry).certificate.publicKey
                    }

                if (publicKey != null) {
                    val publicKeyBytes = publicKey.encoded
                    val publicKeyBase64 = Base64.encodeToString(publicKeyBytes, Base64.NO_WRAP)
                    ret.put("publicKey", publicKeyBase64)
                } else {
                    ret.put("publicKey", JSObject.NULL)
                }
            } else {
                ret.put("publicKey", JSObject.NULL)
            }
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Failed to get public key: ${e.message}", e)
        }
    }

    @PluginMethod
    fun isBiometricAvailable(call: PluginCall) {
        try {
            val biometricManager = BiometricManager.from(context)

            // Android 11 (API 30) 이상에서는 BIOMETRIC_STRONG | DEVICE_CREDENTIAL 지원
            // Android 10 이하에서는 BIOMETRIC_STRONG만 지원
            var available = false

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // Android 11+: BIOMETRIC_STRONG 또는 DEVICE_CREDENTIAL
                val authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG or
                                    BiometricManager.Authenticators.DEVICE_CREDENTIAL
                val canAuthenticate = biometricManager.canAuthenticate(authenticators)
                android.util.Log.d("SecureKeyPlugin", "Android 11+ canAuthenticate result: $canAuthenticate")
                available = canAuthenticate == BiometricManager.BIOMETRIC_SUCCESS
            } else {
                // Android 10 이하: BIOMETRIC_STRONG만 지원 (PIN만으로는 보안 키 생성 불가)
                val canAuthenticateBiometric = biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                android.util.Log.d("SecureKeyPlugin", "Android 10- BIOMETRIC_STRONG result: $canAuthenticateBiometric")

                // Android 10 이하에서는 생체 인증이 필수
                available = canAuthenticateBiometric == BiometricManager.BIOMETRIC_SUCCESS
            }

            val biometryType = when {
                context.packageManager.hasSystemFeature("android.hardware.fingerprint") -> "fingerprint"
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
                    context.packageManager.hasSystemFeature("android.hardware.biometrics.face") -> "face"
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
                    context.packageManager.hasSystemFeature("android.hardware.biometrics.iris") -> "iris"
                else -> "none"
            }

            android.util.Log.d("SecureKeyPlugin", "Final available: $available, biometryType: $biometryType")

            val ret = JSObject()
            ret.put("available", available)
            ret.put("biometryType", biometryType)
            call.resolve(ret)
        } catch (e: Exception) {
            android.util.Log.e("SecureKeyPlugin", "Error checking biometric availability", e)
            call.reject("Failed to check biometric availability: ${e.message}", e)
        }
    }

    @PluginMethod
    fun getDeviceInfo(call: PluginCall) {
        val deviceInfo = "Android ${Build.VERSION.RELEASE} - ${Build.MANUFACTURER} ${Build.MODEL}"
        val ret = JSObject()
        ret.put("deviceInfo", deviceInfo)
        call.resolve(ret)
    }
}
