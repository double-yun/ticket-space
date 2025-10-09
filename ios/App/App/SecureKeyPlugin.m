#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Define the plugin using the CAP_PLUGIN Macro, and
// each method the plugin supports using the CAP_PLUGIN_METHOD macro.
CAP_PLUGIN(SecureKey, "SecureKey",
           CAP_PLUGIN_METHOD(generateKeyPair, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(hasPrivateKey, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(signData, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getPublicKey, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(isBiometricAvailable, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getDeviceInfo, CAPPluginReturnPromise);
)