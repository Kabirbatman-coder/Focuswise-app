import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FocusScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.text}>Focus Screen</Text>
        <Text style={styles.subText}>Active Session Controls</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.h1,
    fontWeight: Typography.weights.bold,
  },
  subText: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.body,
    marginTop: 8,
  },
});

