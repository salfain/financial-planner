import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Financial Planner',
  slug: 'financial-planner-mobile',
  version: '1.0.12',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'financialplanner',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.vinn.financialplanner',
    supportsTablet: false,
    icon: './assets/images/icon.png',
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      NSCameraUsageDescription: 'Financial Planner memakai kamera hanya untuk memindai struk yang Anda pilih.',
      NSPhotoLibraryUsageDescription: 'Financial Planner membuka foto hanya saat Anda memilih struk atau lampiran.',
    },
  },
  android: {
    package: 'com.vinn.financialplanner',
    versionCode: 13,
    softwareKeyboardLayoutMode: 'pan',
    predictiveBackGestureEnabled: true,
    adaptiveIcon: {
      backgroundColor: '#126b59',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 24,
          buildArchs: ['arm64-v8a'],
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          networkInspector: false,
          useLegacyPackaging: true,
        },
        ios: { deploymentTarget: '16.4' },
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#f3f6f4',
        dark: { backgroundColor: '#0e1512' },
        image: './assets/images/splash-icon.png',
        imageWidth: 96,
      },
    ],
    [
      'expo-secure-store',
      {
        configureAndroidBackup: true,
        faceIDPermission: 'Izinkan Financial Planner memakai Face ID untuk melindungi sesi lokal.',
      },
    ],
    'expo-sharing',
    '@react-native-community/datetimepicker',
    [
      'expo-image-picker',
      {
        photosPermission: 'Izinkan Financial Planner membuka struk atau lampiran yang Anda pilih.',
        cameraPermission: 'Izinkan Financial Planner memotret struk yang ingin Anda periksa.',
        microphonePermission: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    minimumBackendSchema: '1.16.0',
  },
});
