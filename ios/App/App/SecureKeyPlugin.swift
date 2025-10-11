import Foundation
import Capacitor
import LocalAuthentication
import Security

@objc(SecureKey)
public class SecureKey: CAPPlugin {

    private let keyTag = "com.ticketing.app.securekey"

    @objc func generateKeyPair(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId") else {
            call.reject("userId is required")
            return
        }

        let promptMessage = call.getString("promptMessage") ?? "Authenticate to create secure key"
        let keyLabel = "\(keyTag).\(userId)"

        // 기존 키 삭제
        deleteKey(keyLabel: keyLabel)

        // 생체 인증 또는 기기 잠금(Passcode) 컨텍스트 생성
        let context = LAContext()
        var error: NSError?

        // .deviceOwnerAuthentication: 생체 인증 또는 Passcode 허용
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            if let error = error {
                call.reject("Authentication not available: \(error.localizedDescription)")
            } else {
                call.reject("No biometric or device passcode enrolled. Please set up a screen lock.")
            }
            return
        }

        // 생체 인증 또는 Passcode 실행
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: promptMessage) { success, authError in
            if success {
                do {
                    let publicKey = try self.doGenerateKeyPair(keyLabel: keyLabel, context: context)
                    call.resolve(["publicKey": publicKey])
                } catch {
                    call.reject("Failed to generate key pair: \(error.localizedDescription)")
                }
            } else {
                call.reject("Authentication failed: \(authError?.localizedDescription ?? "Unknown error")")
            }
        }
    }

    private func doGenerateKeyPair(keyLabel: String, context: LAContext) throws -> String {
        // Secure Enclave 사용 (iOS 9+, A7+ 칩)
        var error: Unmanaged<CFError>?

        // ACL (Access Control List) 생성
        // .userPresence: 생체 인증 또는 Passcode 허용
        guard let accessControl = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            [.privateKeyUsage, .userPresence], // 생체 인증 또는 Passcode
            &error
        ) else {
            throw error!.takeRetainedValue() as Error
        }

        // 키 생성 파라미터
        let privateKeyAttrs: [String: Any] = [
            kSecAttrIsPermanent as String: true,
            kSecAttrApplicationTag as String: keyLabel.data(using: .utf8)!,
            kSecAttrAccessControl as String: accessControl
        ]

        let parameters: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256, // P-256 curve
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave, // Secure Enclave 사용
            kSecPrivateKeyAttrs as String: privateKeyAttrs
        ]

        // 키 생성
        guard let privateKey = SecKeyCreateRandomKey(parameters as CFDictionary, &error) else {
            throw error!.takeRetainedValue() as Error
        }

        // 공개키 추출
        guard let publicKey = SecKeyCopyPublicKey(privateKey) else {
            throw NSError(domain: "SecureKeyPlugin", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to extract public key"])
        }

        // 공개키를 SPKI 형식으로 변환
        var externalError: Unmanaged<CFError>?
        guard let publicKeyData = SecKeyCopyExternalRepresentation(publicKey, &externalError) as Data? else {
            throw externalError!.takeRetainedValue() as Error
        }

        // Raw 형식(65바이트)을 SPKI DER 형식으로 변환
        let spkiData = convertRawPublicKeyToSPKI(publicKeyData)

        // Base64 인코딩
        let publicKeyBase64 = spkiData.base64EncodedString()
        return publicKeyBase64
    }

    @objc func hasPrivateKey(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId") else {
            call.reject("userId is required")
            return
        }

        let keyLabel = "\(keyTag).\(userId)"

        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: keyLabel.data(using: .utf8)!,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecReturnRef as String: true
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        let exists = (status == errSecSuccess)
        call.resolve(["exists": exists])
    }

    @objc func signData(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"),
              let data = call.getString("data") else {
            call.reject("userId and data are required")
            return
        }

        let promptMessage = call.getString("promptMessage") ?? "Authenticate to sign"
        let keyLabel = "\(keyTag).\(userId)"

        // 개인키 조회
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: keyLabel.data(using: .utf8)!,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecReturnRef as String: true,
            kSecUseOperationPrompt as String: promptMessage // 생체 인증 프롬프트
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        guard status == errSecSuccess,
              let privateKey = item as! SecKey? else {
            call.reject("Private key not found or authentication failed")
            return
        }

        do {
            let signature = try self.doSign(privateKey: privateKey, data: data)
            call.resolve(["signature": signature])
        } catch {
            call.reject("Failed to sign data: \(error.localizedDescription)")
        }
    }

    private func doSign(privateKey: SecKey, data: String) throws -> String {
        guard let dataToSign = data.data(using: .utf8) else {
            throw NSError(domain: "SecureKeyPlugin", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid data encoding"])
        }

        var error: Unmanaged<CFError>?
        guard let signature = SecKeyCreateSignature(
            privateKey,
            .ecdsaSignatureMessageX962SHA256,
            dataToSign as CFData,
            &error
        ) as Data? else {
            throw error!.takeRetainedValue() as Error
        }

        return signature.base64EncodedString()
    }

    @objc func getPublicKey(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId") else {
            call.reject("userId is required")
            return
        }

        let keyLabel = "\(keyTag).\(userId)"

        // 개인키 조회
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: keyLabel.data(using: .utf8)!,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecReturnRef as String: true
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        guard status == errSecSuccess,
              let privateKey = item as! SecKey?,
              let publicKey = SecKeyCopyPublicKey(privateKey) else {
            call.resolve(["publicKey": NSNull()])
            return
        }

        var error: Unmanaged<CFError>?
        guard let publicKeyData = SecKeyCopyExternalRepresentation(publicKey, &error) as Data? else {
            call.resolve(["publicKey": NSNull()])
            return
        }

        let publicKeyBase64 = publicKeyData.base64EncodedString()
        call.resolve(["publicKey": publicKeyBase64])
    }

    @objc func isBiometricAvailable(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?

        let available = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)

        var biometryType = "none"
        if available {
            switch context.biometryType {
            case .faceID:
                biometryType = "face"
            case .touchID:
                biometryType = "fingerprint"
            default:
                biometryType = "none"
            }
        }

        call.resolve([
            "available": available,
            "biometryType": biometryType
        ])
    }

    @objc func getDeviceInfo(_ call: CAPPluginCall) {
        let systemVersion = UIDevice.current.systemVersion
        let model = UIDevice.current.model
        let deviceInfo = "iOS \(systemVersion) - \(model)"

        call.resolve(["deviceInfo": deviceInfo])
    }

    private func deleteKey(keyLabel: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: keyLabel.data(using: .utf8)!
        ]
        SecItemDelete(query as CFDictionary)
    }

    // Raw 공개키(65바이트)를 SPKI DER 형식으로 변환
    private func convertRawPublicKeyToSPKI(_ rawPublicKey: Data) -> Data {
        // P-256 SPKI 헤더 (ASN.1 DER 인코딩)
        let spkiHeader: [UInt8] = [
            0x30, 0x59, // SEQUENCE, 89 bytes
            0x30, 0x13, // SEQUENCE, 19 bytes (algorithm identifier)
            0x06, 0x07, // OID, 7 bytes
            0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // ecPublicKey OID
            0x06, 0x08, // OID, 8 bytes
            0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // prime256v1 OID
            0x03, 0x42, // BIT STRING, 66 bytes
            0x00 // 0 unused bits
        ]

        var spkiData = Data(spkiHeader)
        spkiData.append(rawPublicKey)
        return spkiData
    }
}
