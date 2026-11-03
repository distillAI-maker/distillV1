import Capacitor
import UIKit
import WebKit

/// The app's one screen: Capacitor's web view showing the live app (server.url in capacitor.config.ts),
/// plus the few native touches a website can't give itself.
final class DistillViewController: CAPBridgeViewController {
    private var policy: NavigationPolicy?
    private var cover: UIView?
    private var star: UIImageView?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let webView = webView, let bridge = bridge,
              let capacitor = webView.navigationDelegate as? WebViewDelegationHandler else { return }

        let policy = NavigationPolicy(webView: webView, config: bridge.config, capacitor: capacitor, presenter: self)
        policy.onFirstLoad = { [weak self] in self?.liftCover() }
        webView.navigationDelegate = policy
        webView.uiDelegate = policy
        self.policy = policy

        view = container(for: webView)
        // Swipe from the edge to go back, as in Safari and most apps.
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.keyboardDismissMode = .interactive
        hideFormBar()
        let scripts = webView.configuration.userContentController
        scripts.addUserScript(Self.fitScript(host: bridge.config.serverURL.host))
        scripts.addUserScript(Self.paintedScript)
        scripts.add(policy, name: NavigationPolicy.painted)
        #if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        #endif

        // A tapped sign-in link (a universal link to the app's site) opens in here, not in Safari.
        NotificationCenter.default.addObserver(self, selector: #selector(openLink(_:)),
                                               name: .capacitorOpenUniversalLink, object: nil)
        showCover()
    }

    @objc private func openLink(_ note: Notification) {
        guard let info = note.object as? [String: Any], let url = info["url"] as? URL else { return }
        presentedViewController?.dismiss(animated: false)
        policy?.open(url)
    }

    // MARK: - Keyboard

    /// Capacitor makes the web view the whole screen. Inside a plain view instead, it can end where the
    /// keyboard begins, so a screen's button stays above the keyboard the way it does in any app,
    /// instead of the page sliding up under the status bar.
    private func container(for webView: WKWebView) -> UIView {
        let container = UIView()
        container.backgroundColor = UIColor(named: "Ground")
        webView.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(webView)
        let keyboard = container.keyboardLayoutGuide
        // Down to the bottom edge when the keyboard is away, so the page still pads its own home bar.
        if #available(iOS 17.0, *) { keyboard.usesBottomSafeArea = false }
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: container.topAnchor),
            webView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: keyboard.topAnchor),
        ])
        return container
    }

    /// WebKit puts a previous / next / done bar over the keyboard, which only websites have. Its content
    /// view's inputAccessoryView answers nothing instead, the way Capacitor's Keyboard plugin does it.
    private func hideFormBar() {
        let selector = #selector(getter: UIResponder.inputAccessoryView)
        guard let content = NSClassFromString(["WK", "Content", "View"].joined()),
              let original = class_getInstanceMethod(content, selector) else { return }
        let empty: @convention(block) (AnyObject) -> UIView? = { _ in nil }
        class_replaceMethod(content, selector, imp_implementationWithBlock(empty), method_getTypeEncoding(original))
    }

    // MARK: - Launch cover

    /// The launch screen stays up (as the same ground and star) until the first page has drawn, so the
    /// app never flashes an empty screen while it loads. The policy says when (paintedScript, or the
    /// load finishing or failing, whichever is first).
    private func showCover() {
        let cover = UIView()
        cover.backgroundColor = UIColor(named: "Ground")
        let star = UIImageView(image: UIImage(named: "LaunchStar"))
        star.translatesAutoresizingMaskIntoConstraints = false
        cover.addSubview(star)
        cover.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(cover)
        NSLayoutConstraint.activate([
            cover.topAnchor.constraint(equalTo: view.topAnchor),
            cover.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            cover.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            cover.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            star.centerXAnchor.constraint(equalTo: cover.centerXAnchor),
            star.centerYAnchor.constraint(equalTo: cover.centerYAnchor),
            star.widthAnchor.constraint(equalToConstant: 64),
            star.heightAnchor.constraint(equalToConstant: 64),
        ])
        self.cover = cover
        self.star = star
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in self?.turnStar() }
        // Never hold the app back for long on a slow connection.
        DispatchQueue.main.asyncAfter(deadline: .now() + 12) { [weak self] in self?.liftCover() }
    }

    /// Still loading after a second: the mark turns, the way it does in the app while Distill is
    /// shaping something (ds-turn in ds.css).
    private func turnStar() {
        guard cover != nil, let star = star, !UIAccessibility.isReduceMotionEnabled else { return }
        let turn = CABasicAnimation(keyPath: "transform.rotation.z")
        turn.byValue = 2 * Double.pi
        turn.duration = 1.5
        turn.timingFunction = CAMediaTimingFunction(controlPoints: 0.4, 0, 0.2, 1)
        turn.repeatCount = .infinity
        star.layer.add(turn, forKey: "turn")
    }

    /// Two animation frames after the page is parsed, its first frame has been drawn.
    private static let paintedScript = WKUserScript(source: """
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { window.webkit.messageHandlers.\(NavigationPolicy.painted).postMessage(1); });
        });
        """, injectionTime: .atDocumentEnd, forMainFrameOnly: true)

    private func liftCover() {
        guard let cover = cover else { return }
        self.cover = nil
        // A beat more, so the first screen is settled before it shows.
        UIView.animate(withDuration: 0.3, delay: 0.15, options: [.curveEaseOut], animations: {
            cover.alpha = 0
        }, completion: { _ in cover.removeFromSuperview() })
    }

    // MARK: - Safe areas

    /// The app's CSS already pads for the notch and the home indicator with env(safe-area-inset-*),
    /// which only takes effect with viewport-fit=cover. Added here, in the app only, so the website in
    /// Safari is unchanged. Only on the app's own pages, never on a wearable's sign-in page. Next.js
    /// writes more than one viewport tag (WebKit reads the last) and can add one as a page streams in,
    /// so every one gets it, whenever it appears.
    private static func fitScript(host: String?) -> WKUserScript {
        let source = """
        (function () {
          if (location.hostname !== '\(host ?? "")') return;
          function fit() {
            document.querySelectorAll('meta[name="viewport"]').forEach(function (m) {
              if (m.content.indexOf('viewport-fit') === -1) m.content += ', viewport-fit=cover';
            });
          }
          fit();
          new MutationObserver(fit).observe(document.documentElement, {
            childList: true, subtree: true, attributes: true, attributeFilter: ['content']
          });
        })();
        """
        return WKUserScript(source: source, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
    }
}
