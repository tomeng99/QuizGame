import { useState } from "react";
import { Text, View } from "react-native";
import type { LayoutChangeEvent, GestureResponderEvent } from "react-native";
import { styles } from "../styles";

interface SliderQuestionProps {
  minValue: number;
  maxValue: number;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}

const clamp = (value: number, minValue: number, maxValue: number) =>
  Math.min(maxValue, Math.max(minValue, value));

export function SliderQuestion({
  minValue,
  maxValue,
  value,
  disabled,
  onChange,
}: SliderQuestionProps) {
  const [trackWidth, setTrackWidth] = useState(1);
  const range = maxValue - minValue;
  const safeValue = clamp(value, minValue, maxValue);
  const progress = range === 0 ? 1 : (safeValue - minValue) / range;

  const updateFromPosition = (locationX: number) => {
    if (disabled || trackWidth <= 0) {
      return;
    }

    const ratio = clamp(locationX / trackWidth, 0, 1);
    onChange(Math.round(minValue + ratio * range));
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width || 1);
  };

  const handleGesture = (event: GestureResponderEvent) => {
    updateFromPosition(event.nativeEvent.locationX);
  };

  return (
    <View style={styles.sliderQuestionCard}>
      <Text style={styles.sliderQuestionValue}>{safeValue}</Text>
      <View style={styles.sliderQuestionLabels}>
        <Text style={styles.sliderQuestionLabel}>{minValue}</Text>
        <Text style={styles.sliderQuestionLabel}>{maxValue}</Text>
      </View>
      <View
        onLayout={handleLayout}
        onResponderGrant={handleGesture}
        onResponderMove={handleGesture}
        onStartShouldSetResponder={() => !disabled}
        style={styles.sliderTrack}
      >
        <View style={[styles.sliderTrackFill, { width: `${progress * 100}%` as `${number}%` }]} />
        <View style={[styles.sliderThumb, { left: `${progress * 100}%` as `${number}%` }]} />
      </View>
      <Text style={styles.sliderQuestionHint}>
        Drag or tap to choose your closest guess.
      </Text>
    </View>
  );
}
