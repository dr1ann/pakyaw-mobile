import { Component, type ComponentType } from 'react';
import { Button, Modal, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { ApplicationVerifier } from 'firebase/auth';
import type { WebViewProps } from 'react-native-webview';

let WebViewComponent: ComponentType<WebViewProps> | null = null;
function getWebView(): ComponentType<WebViewProps> | null {
  if (!WebViewComponent) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const module = require('react-native-webview');
      WebViewComponent = module.WebView ?? module.default ?? module;
    } catch {
      return null;
    }
  }
  return WebViewComponent;
}

type FirebaseWebConfig = Readonly<{
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}>;

type Props = Readonly<{ firebaseConfig: FirebaseWebConfig }>;
type State = Readonly<{ visible: boolean; key: number }>;
type PendingVerification = Readonly<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}>;

type WebMessage = Readonly<{
  type?: 'loaded' | 'verified' | 'expired' | 'error';
  token?: string;
  message?: string;
}>;

const FIREBASE_COMPAT_VERSION = '12.15.0';

function createRecaptchaDocument(firebaseConfig: FirebaseWebConfig): string {
  const config = JSON.stringify(firebaseConfig).replace(/</g, '\\u003c');

  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
<style>html,body,#recaptcha-container{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;background:#fff}</style>
<script src="https://www.gstatic.com/firebasejs/${FIREBASE_COMPAT_VERSION}/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/${FIREBASE_COMPAT_VERSION}/firebase-auth-compat.js"></script>
</head><body><div id="recaptcha-container"></div><script>
  function emit(type, payload) {
    window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, payload || {})));
  }
  function report(error) {
    emit('error', { message: error && error.message ? error.message : 'Unable to load the security check.' });
  }
  try {
    firebase.initializeApp(${config});
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
      size: 'normal',
      callback: function(token) { emit('verified', { token: token }); },
      'expired-callback': function() { emit('expired'); }
    });
    window.recaptchaVerifier.render().then(function() { emit('loaded'); }).catch(report);
  } catch (error) { report(error); }
</script></body></html>`;
}

/**
 * React Native implementation of Firebase Auth's ApplicationVerifier.
 * The browser-only reCAPTCHA runs in a WebView, while the Firebase JS Auth
 * session remains in the app, so Firestore continues to receive its auth token.
 */
export class FirebaseRecaptchaVerifierModal
  extends Component<Props, State>
  implements ApplicationVerifier {
  readonly type = 'recaptcha';

  state: State = { visible: false, key: 0 };
  private pending?: PendingVerification;

  verify(): Promise<string> {
    if (this.pending) {
      return Promise.reject(new Error('A mobile verification request is already in progress.'));
    }

    const WebView = getWebView();
    if (!WebView) {
      return Promise.reject(new Error('In-app security verification is not supported in this environment.'));
    }

    return new Promise<string>((resolve, reject) => {
      this.pending = { resolve, reject };
      this.setState((current) => ({ visible: true, key: current.key + 1 }));
    });
  }

  /** Firebase may reset a verifier after a failed phone-auth request. */
  _reset(): void {}

  private finish(token: string): void {
    const pending = this.pending;
    this.pending = undefined;
    this.setState({ visible: false, key: this.state.key });
    pending?.resolve(token);
  }

  private fail(message: string): void {
    const pending = this.pending;
    this.pending = undefined;
    this.setState({ visible: false, key: this.state.key });
    pending?.reject(new Error(message));
  }

  private onMessage = (event: { nativeEvent: { data: string } }): void => {
    let message: WebMessage;
    try {
      message = JSON.parse(event.nativeEvent.data) as WebMessage;
    } catch {
      this.fail('Unable to complete the security check. Please try again.');
      return;
    }

    if (message.type === 'verified' && message.token) {
      this.finish(message.token);
    } else if (message.type === 'error') {
      this.fail('Unable to load the security check. Please check your connection and try again.');
    }
  };

  render() {
    if (!this.state.visible) {
      return null;
    }

    const WebView = getWebView();
    if (!WebView) {
      return null;
    }

    return (
      <Modal
        visible={this.state.visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => this.fail('Security check cancelled.')}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Security check</Text>
            <Button title="Cancel" onPress={() => this.fail('Security check cancelled.')} />
          </View>
          <WebView
            key={this.state.key}
            source={{
              html: createRecaptchaDocument(this.props.firebaseConfig),
              baseUrl: `https://${this.props.firebaseConfig.authDomain}`,
            }}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            onMessage={this.onMessage}
            onError={() => this.fail('Unable to load the security check. Please check your connection and try again.')}
          />
        </SafeAreaView>
      </Modal>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D9E0EA' },
  title: { fontSize: 16, fontWeight: '700', color: '#0E1726' },
});
