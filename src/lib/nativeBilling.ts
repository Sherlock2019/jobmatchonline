import { Capacitor, registerPlugin } from '@capacitor/core';

/** Thin wrappers around the two native plugins (android/app/.../
 * PlayBillingPlugin.java, ios/App/App/AppleIAPPlugin.swift). Only usable
 * inside the compiled native app on the matching platform — on web these
 * plugins don't exist, so every call here is gated behind isAndroidNative()/
 * isIosNative() first. Purchasing here only starts the flow; the actual
 * entitlement only ever comes from the server verifying the resulting
 * token/transaction (see api.verifyGooglePlayPurchase / api.verifyApplePurchase). */

interface PlayBillingPlugin {
  initialize(): Promise<void>;
  queryProductDetails(options: { productId: string }): Promise<{ productId: string; title: string; offerToken?: string; formattedPrice?: string }>;
  purchase(options: { productId: string; offerToken: string }): Promise<{ purchases: { purchaseToken: string; products: string[] }[] }>;
}

interface AppleIAPPlugin {
  queryProduct(options: { productId: string }): Promise<{ productId: string; displayName: string; displayPrice: string }>;
  purchase(options: { productId: string }): Promise<{ transactionId?: string; originalTransactionId?: string; pending?: boolean }>;
}

const PlayBilling = registerPlugin<PlayBillingPlugin>('PlayBilling');
const AppleIAP = registerPlugin<AppleIAPPlugin>('AppleIAP');

export function isAndroidNative() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}
export function isIosNative() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

/** Runs the full Google Play purchase flow and returns the purchase token
 * to send to api.verifyGooglePlayPurchase() — the token itself proves
 * nothing until our server verifies it against the Android Publisher API. */
export async function purchaseGooglePlaySubscription(productId: string): Promise<string> {
  await PlayBilling.initialize();
  const details = await PlayBilling.queryProductDetails({ productId });
  if (!details.offerToken) throw new Error('No subscription offer available for this product');
  const result = await PlayBilling.purchase({ productId, offerToken: details.offerToken });
  const purchase = result.purchases.find((entry) => entry.products.includes(productId));
  if (!purchase) throw new Error('Purchase did not complete');
  return purchase.purchaseToken;
}

/** Runs the StoreKit 2 purchase flow and returns the transaction id to send
 * to api.verifyApplePurchase(). */
export async function purchaseAppleSubscription(productId: string): Promise<string> {
  const result = await AppleIAP.purchase({ productId });
  if (result.pending) throw new Error('Purchase is pending approval (e.g. Ask to Buy) — check back once approved');
  if (!result.transactionId) throw new Error('Purchase did not complete');
  return result.transactionId;
}
