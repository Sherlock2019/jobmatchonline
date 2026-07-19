import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

const appUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://jobsmatchnow.com/app/';

export default function JobsMatchNowPreview() {
  const webView = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Image source={require('../assets/images/icon.png')} style={styles.logo} contentFit="contain" />
        <View style={styles.brandBlock}>
          <Text style={styles.wordmark}><Text style={styles.jobs}>Jobs</Text><Text style={styles.match}>Match</Text><Text style={styles.now}>Now</Text></Text>
          <Text style={styles.feature}>Geolocation of Opportunities</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Reload JobsMatchNow" onPress={() => { setFailed(false); setLoading(true); webView.current?.reload(); }} style={styles.reload}>
          <Text style={styles.reloadText}>Reload</Text>
        </Pressable>
      </View>
      <View style={styles.promise}><Text style={styles.promiseText}>Match nearby. Meet for a cup of coffee in your city.</Text></View>
      <View style={styles.webContainer}>
        <WebView
          ref={webView}
          source={{ uri: appUrl }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setFailed(true); }}
          onContentProcessDidTerminate={() => webView.current?.reload()}
          allowsBackForwardNavigationGestures
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          applicationNameForUserAgent="JobsMatchNowExpoPreview/1.0"
          style={styles.webView}
        />
        {loading && <View style={styles.overlay}><ActivityIndicator size="large" color="#1762e8" /><Text style={styles.loadingText}>Finding nearby opportunities…</Text></View>}
        {failed && <View style={styles.overlay}><Text style={styles.errorTitle}>The preview could not connect.</Text><Text style={styles.errorCopy}>Check Wi-Fi, keep the launcher running, then tap Reload.</Text></View>}
      </View>
      <Text style={styles.previewNote}>{Platform.OS === 'ios' ? 'iOS' : 'Android'} Expo preview · Production releases use signed store builds</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff8fb' },
  header: { minHeight: 64, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e7e6ed', backgroundColor: '#ffffff' },
  logo: { width: 42, height: 42, borderRadius: 10 },
  brandBlock: { flex: 1 },
  wordmark: { fontSize: 19, fontWeight: '900', letterSpacing: -0.7 },
  jobs: { color: '#0b102b' }, match: { color: '#1762e8' }, now: { color: '#ed103c' },
  feature: { marginTop: 2, color: '#697085', fontSize: 8, fontWeight: '700', letterSpacing: 0.45, textTransform: 'uppercase' },
  reload: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: '#edf7ff' },
  reloadText: { color: '#1762e8', fontSize: 11, fontWeight: '800' },
  promise: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff0f5', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ffd7e5' },
  promiseText: { color: '#8c284d', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  webContainer: { flex: 1, position: 'relative', backgroundColor: '#ffffff' },
  webView: { flex: 1, backgroundColor: '#ffffff' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28, backgroundColor: '#fff8fb' },
  loadingText: { color: '#697085', fontSize: 12, fontWeight: '600' },
  errorTitle: { color: '#0b102b', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  errorCopy: { maxWidth: 300, color: '#697085', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  previewNote: { paddingVertical: 6, color: '#7b8192', backgroundColor: '#ffffff', fontSize: 8, textAlign: 'center' },
});
