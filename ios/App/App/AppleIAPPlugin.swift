import Foundation
import Capacitor
import StoreKit

/// Wraps StoreKit 2 for the recruiter-subscription product. A transaction
/// completing here is NOT the confirmation authority — the JS side sends
/// the signed transaction id to our own server, which re-verifies it
/// against Apple's App Store Server API and only then extends the
/// subscription. See server/billing/providers/applestore.js.
///
/// Auto-discovered by Capacitor at launch via the CAPBridgedPlugin
/// conformance below (same mechanism as the other plugins in this app —
/// no manual registration in AppDelegate needed).
@objc(AppleIAPPlugin)
public class AppleIAPPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppleIAPPlugin"
    public let jsName = "AppleIAP"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "queryProduct", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise)
    ]

    private var updateListenerTask: Task<Void, Error>?

    public override func load() {
        // Catches renewals/refunds/family-sharing transactions that arrive
        // outside of an explicit purchase() call in this session.
        updateListenerTask = Task.detached { [weak self] in
            for await result in Transaction.updates {
                await self?.handleTransactionUpdate(result)
            }
        }
    }

    deinit {
        updateListenerTask?.cancel()
    }

    @MainActor
    private func handleTransactionUpdate(_ result: VerificationResult<Transaction>) async {
        guard case .verified(let transaction) = result else { return }
        notifyListeners("transactionUpdated", data: transactionPayload(transaction))
        await transaction.finish()
    }

    private func transactionPayload(_ transaction: Transaction) -> [String: Any] {
        return [
            "transactionId": String(transaction.id),
            "originalTransactionId": String(transaction.originalID),
            "productId": transaction.productID
        ]
    }

    @objc func queryProduct(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("productId is required")
            return
        }
        Task {
            do {
                let products = try await Product.products(for: [productId])
                guard let product = products.first else {
                    call.reject("Product not found")
                    return
                }
                call.resolve([
                    "productId": product.id,
                    "displayName": product.displayName,
                    "displayPrice": product.displayPrice
                ])
            } catch {
                call.reject("Failed to load product: \(error.localizedDescription)")
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("productId is required")
            return
        }
        Task {
            do {
                let products = try await Product.products(for: [productId])
                guard let product = products.first else {
                    call.reject("Product not found")
                    return
                }
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        call.resolve(transactionPayload(transaction))
                        await transaction.finish()
                    case .unverified(_, let error):
                        call.reject("Transaction could not be verified by StoreKit: \(error.localizedDescription)")
                    }
                case .userCancelled:
                    call.reject("Purchase was cancelled")
                case .pending:
                    call.resolve(["pending": true])
                @unknown default:
                    call.reject("Unknown purchase result")
                }
            } catch {
                call.reject("Purchase failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                var transactions: [[String: Any]] = []
                for await result in Transaction.currentEntitlements {
                    if case .verified(let transaction) = result {
                        transactions.append(transactionPayload(transaction))
                    }
                }
                call.resolve(["transactions": transactions])
            } catch {
                call.reject("Restore failed: \(error.localizedDescription)")
            }
        }
    }
}
