import UIKit
import Capacitor

class CAPBridgeViewController: CAPBridgeViewController {

    override func viewDidLoad() {
        super.viewDidLoad()

        // 카카오 로그인 플러그인 수동 등록
        self.bridge?.registerPluginInstance(KakaoLoginPlugin())
    }
}