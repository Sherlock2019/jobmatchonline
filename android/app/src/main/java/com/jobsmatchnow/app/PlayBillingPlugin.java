package com.jobsmatchnow.app;

import android.app.Activity;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Collections;
import java.util.List;

/**
 * Wraps Google Play Billing Library for the recruiter-subscription product.
 * Purchases are acknowledged here (Google auto-refunds an unacknowledged
 * purchase after 3 days), but entitlement is never granted from this
 * acknowledgement alone — the JS side sends the purchase token to our own
 * server, which verifies it against the Android Publisher API and only then
 * extends the subscription. See server/billing/providers/googleplay.js.
 */
@CapacitorPlugin(name = "PlayBilling")
public class PlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    private BillingClient billingClient;

    @PluginMethod
    public void initialize(PluginCall call) {
        if (billingClient != null && billingClient.isReady()) {
            call.resolve();
            return;
        }
        billingClient = BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases()
                .build();
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    call.resolve();
                } else {
                    call.reject("Billing setup failed: " + billingResult.getDebugMessage());
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Capacitor JS side should call initialize() again before the next purchase attempt.
            }
        });
    }

    @PluginMethod
    public void queryProductDetails(PluginCall call) {
        String productId = call.getString("productId");
        if (productId == null) {
            call.reject("productId is required");
            return;
        }
        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.SUBS)
                .build();
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(product))
                .build();
        billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsList) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK || productDetailsList.isEmpty()) {
                call.reject("Product not found: " + billingResult.getDebugMessage());
                return;
            }
            ProductDetails details = productDetailsList.get(0);
            JSObject result = new JSObject();
            result.put("productId", details.getProductId());
            result.put("title", details.getTitle());
            List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
            if (offers != null && !offers.isEmpty()) {
                ProductDetails.SubscriptionOfferDetails offer = offers.get(0);
                result.put("offerToken", offer.getOfferToken());
                if (!offer.getPricingPhases().getPricingPhaseList().isEmpty()) {
                    result.put("formattedPrice", offer.getPricingPhases().getPricingPhaseList().get(0).getFormattedPrice());
                }
            }
            call.resolve(result);
        });
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId");
        String offerToken = call.getString("offerToken");
        if (productId == null || offerToken == null) {
            call.reject("productId and offerToken are required (call queryProductDetails first)");
            return;
        }
        saveCall(call);
        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.SUBS)
                .build();
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(product))
                .build();
        billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsList) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK || productDetailsList.isEmpty()) {
                call.reject("Product not found");
                return;
            }
            BillingFlowParams.ProductDetailsParams detailsParams = BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(productDetailsList.get(0))
                    .setOfferToken(offerToken)
                    .build();
            BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(detailsParams))
                    .build();
            Activity activity = getActivity();
            if (activity == null) {
                call.reject("No active activity to launch the billing flow from");
                return;
            }
            billingClient.launchBillingFlow(activity, flowParams);
            // The result arrives asynchronously via onPurchasesUpdated below, which
            // resolves the same saved call — nothing more to do on this thread.
        });
    }

    @PluginMethod
    public void queryActivePurchases(PluginCall call) {
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build();
        billingClient.queryPurchasesAsync(params, (billingResult, purchases) -> {
            JSArray array = new JSArray();
            for (Purchase purchase : purchases) array.put(toJs(purchase));
            JSObject result = new JSObject();
            result.put("purchases", array);
            call.resolve(result);
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        PluginCall call = getSavedCall();
        if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK || purchases == null) {
            if (call != null) call.reject("Purchase failed or was cancelled: " + billingResult.getDebugMessage());
            return;
        }
        for (Purchase purchase : purchases) {
            if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED && !purchase.isAcknowledged()) {
                AcknowledgePurchaseParams ackParams = AcknowledgePurchaseParams.newBuilder()
                        .setPurchaseToken(purchase.getPurchaseToken())
                        .build();
                billingClient.acknowledgePurchase(ackParams, ackResult -> {
                    // Acknowledged so Google won't auto-refund it; entitlement itself is
                    // only ever granted after our own server verifies the purchase token.
                });
            }
        }
        if (call != null) {
            JSArray array = new JSArray();
            for (Purchase purchase : purchases) array.put(toJs(purchase));
            JSObject result = new JSObject();
            result.put("purchases", array);
            call.resolve(result);
        }
    }

    private JSObject toJs(Purchase purchase) {
        JSObject obj = new JSObject();
        obj.put("purchaseToken", purchase.getPurchaseToken());
        obj.put("orderId", purchase.getOrderId());
        obj.put("purchaseState", purchase.getPurchaseState());
        obj.put("isAcknowledged", purchase.isAcknowledged());
        JSArray products = new JSArray();
        for (String productId : purchase.getProducts()) products.put(productId);
        obj.put("products", products);
        return obj;
    }
}
