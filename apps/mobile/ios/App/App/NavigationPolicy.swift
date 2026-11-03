import Capacitor
import SafariServices
import UIKit
import WebKit

/// Sits in front of Capacitor's web view delegate and passes everything on to it, except:
/// - a load that was only cancelled (a newer one replaced it) is not mistaken for being offline;
/// - a real network failure shows offline.html, which retries the page that failed;
/// - links to other sites open in a Safari sheet inside the app instead of leaving it.
final class NavigationPolicy: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    /// Posted by DistillViewController's script once a page has drawn its first frame.
    static let painted = "distillPainted"

    var onFirstLoad: (() -> Void)?

    private weak var webView: WKWebView?
    private weak var presenter: UIViewController?
    private let config: InstanceConfiguration
    private let capacitor: WebViewDelegationHandler

    init(webView: WKWebView, config: InstanceConfiguration, capacitor: WebViewDelegationHandler,
         presenter: UIViewController) {
        self.webView = webView
        self.config = config
        self.capacitor = capacitor
        self.presenter = presenter
    }

    /// Opens a link to the app's own site (a sign-in link from the email) in the web view.
    func open(_ url: URL) {
        guard isApp(url) else { return }
        webView?.load(URLRequest(url: url))
    }

    // MARK: - Everything else goes to Capacitor

    override func responds(to selector: Selector!) -> Bool {
        super.responds(to: selector) || capacitor.responds(to: selector)
    }

    override func forwardingTarget(for selector: Selector!) -> Any? {
        capacitor.responds(to: selector) ? capacitor : nil
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = action.request.url, isOutside(url), action.targetFrame?.isMainFrame ?? true {
            openOutside(url)
            decisionHandler(.cancel)
            return
        }
        capacitor.webView(webView, decidePolicyFor: action, decisionHandler: decisionHandler)
    }

    // swiftlint:disable:next implicitly_unwrapped_optional
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        capacitor.webView(webView, didFinish: navigation)
        firstLoadDone()
    }

    // swiftlint:disable:next implicitly_unwrapped_optional
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
                 withError error: Error) {
        failed(webView, error)
    }

    // swiftlint:disable:next implicitly_unwrapped_optional
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        failed(webView, error)
    }

    private func failed(_ webView: WKWebView, _ error: Error) {
        let error = error as NSError
        // A newer load replaced this one (a sign-in link arriving as the app opens, a second tap).
        if error.domain == NSURLErrorDomain && error.code == NSURLErrorCancelled { return }
        // Interrupted by a policy decision, or handed to the media player: not a failure either.
        if error.domain == "WebKitErrorDomain" && (error.code == 102 || error.code == 204) { return }
        guard let errorURL = config.errorPathURL,
              var page = URLComponents(url: errorURL, resolvingAgainstBaseURL: false) else { return }
        if let failedURL = error.userInfo[NSURLErrorFailingURLErrorKey] as? URL, isApp(failedURL) {
            page.queryItems = [URLQueryItem(name: "retry", value: failedURL.absoluteString)]
        }
        if let url = page.url { webView.load(URLRequest(url: url)) }
        firstLoadDone()
    }

    // MARK: - WKScriptMessageHandler

    /// The first frame is on screen: the page's own HTML and styles, often seconds before every image
    /// and font has finished (which is when didFinish comes).
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == Self.painted { firstLoadDone() }
    }

    private func firstLoadDone() {
        onFirstLoad?()
        onFirstLoad = nil
    }

    // MARK: - WKUIDelegate

    /// target="_blank" links (an explore idea's site): the app's own pages stay in the app, other sites
    /// open in a Safari sheet, anything else (mail, phone) goes to the system as before.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard let url = action.request.url else { return nil }
        if isApp(url) {
            webView.load(action.request)
        } else if isWeb(url) {
            openOutside(url)
        } else {
            return capacitor.webView(webView, createWebViewWith: configuration, for: action,
                                     windowFeatures: windowFeatures)
        }
        return nil
    }

    // MARK: - Helpers

    private func isWeb(_ url: URL) -> Bool {
        url.scheme == "https" || url.scheme == "http"
    }

    private func isApp(_ url: URL) -> Bool {
        url.scheme == config.serverURL.scheme && url.host == config.serverURL.host
    }

    /// A page on another site that isn't one of the wearable sign-ins capacitor.config.ts allows.
    private func isOutside(_ url: URL) -> Bool {
        guard isWeb(url), let host = url.host else { return false }
        return !isApp(url) && !config.shouldAllowNavigation(to: host)
    }

    private func openOutside(_ url: URL) {
        guard let presenter = presenter, presenter.presentedViewController == nil else {
            UIApplication.shared.open(url)
            return
        }
        let safari = SFSafariViewController(url: url)
        safari.preferredControlTintColor = UIColor(named: "Ink")
        safari.dismissButtonStyle = .done
        presenter.present(safari, animated: true)
    }
}
