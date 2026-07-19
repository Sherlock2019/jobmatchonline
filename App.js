import React from 'react';
import { WebView } from 'react-native-webview';
import { SafeAreaView, StyleSheet, StatusBar, Platform } from 'react-native';

export default function App() {
  // This points to your live development URL
  const devUrl = 'https://ais-dev-wgqrbi75j2kcer5dfjpsgt-788856885719.asia-east1.run.app';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <WebView 
        source={{ uri: devUrl }} 
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
  },
  webview: {
    flex: 1,
  },
});
