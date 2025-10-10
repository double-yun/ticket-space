import UIKit
import Capacitor

class BridgeViewController: CAPBridgeViewController {

    override func viewDidLoad() {
        super.viewDidLoad()

        // SecureKey 플러그인 수동 등록
        print("🔵 BridgeViewController viewDidLoad - registering SecureKeyPlugin")
        self.bridge?.registerPluginInstance(SecureKey())
        print("🔵 SecureKeyPlugin registration completed")
    }
}