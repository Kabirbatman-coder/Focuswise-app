import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography } from '../../constants/theme';

export default function AIChiefScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>AI Chief Command Center</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)', // Semi-transparent if it were a modal, but here it's a screen
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.h2,
    fontWeight: Typography.weights.bold,
  },
});

