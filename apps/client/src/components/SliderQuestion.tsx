import { useState } from "react";
import type {
  AccessibilityActionEvent,
  GestureResponderEvent,
  LayoutChangeEvent,
} from "react-native";
import { Pressable, Text, View } from "react-native";
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

  // Twenty steps across the range keeps the stepper usable on a 0-1000 question without
  // making a 0-10 one jump more than one at a time.
  const step = Math.max(1, Math.round(range / 20));

  const updateFromPosition = (locationX: number) => {
    if (disabled || trackWidth <= 0) {
      return;
    }

    const ratio = clamp(locationX / trackWidth, 0, 1);
    onChange(Math.round(minValue + ratio * range));
  };

  const stepBy = (delta: number) => {
    if (disabled) {
      return;
    }

    onChange(clamp(safeValue + delta, minValue, maxValue));
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width || 1);
  };

  const handleGesture = (event: GestureResponderEvent) => {
    updateFromPosition(event.nativeEvent.locationX);
  };

  // VoiceOver and TalkBack adjust a slider with a swipe up/down rather than a drag, so the
  // track has to answer the increment/decrement actions itself.
  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "increment") {
      stepBy(step);
    } else if (event.nativeEvent.actionName === "decrement") {
      stepBy(-step);
    }
  };

  const atMin = safeValue <= minValue;
  const atMax = safeValue >= maxValue;

  return (
    <View style={styles.sliderQuestionCard}>
      {/* Dragging the track needs a pointer, so the steppers are the only way a keyboard,
          switch, or screen-reader user can pick a number. They are not a nicety. */}
      <View style={styles.sliderStepperRow}>
        <Pressable
          aria-disabled={disabled || atMin}
          aria-label={`Decrease guess by ${step}`}
          disabled={disabled || atMin}
          onPress={() => stepBy(-step)}
          role="button"
          style={[styles.sliderStepperButton, (disabled || atMin) && styles.disabledButton]}
        >
          <Text style={styles.sliderStepperButtonText}>{"−"}</Text>
        </Pressable>
        <Text style={styles.sliderQuestionValue}>{safeValue}</Text>
        <Pressable
          aria-disabled={disabled || atMax}
          aria-label={`Increase guess by ${step}`}
          disabled={disabled || atMax}
          onPress={() => stepBy(step)}
          role="button"
          style={[styles.sliderStepperButton, (disabled || atMax) && styles.disabledButton]}
        >
          <Text style={styles.sliderStepperButtonText}>{"+"}</Text>
        </Pressable>
      </View>
      <View aria-hidden style={styles.sliderQuestionLabels}>
        <Text style={styles.sliderQuestionLabel}>{minValue}</Text>
        <Text style={styles.sliderQuestionLabel}>{maxValue}</Text>
      </View>
      <View
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        aria-disabled={disabled}
        aria-label="Your number guess"
        aria-valuemax={maxValue}
        aria-valuemin={minValue}
        aria-valuenow={safeValue}
        aria-valuetext={String(safeValue)}
        onAccessibilityAction={handleAccessibilityAction}
        onLayout={handleLayout}
        onResponderGrant={handleGesture}
        onResponderMove={handleGesture}
        onStartShouldSetResponder={() => !disabled}
        role="slider"
        style={styles.sliderTrack}
      >
        <View style={[styles.sliderTrackFill, { width: `${progress * 100}%` as `${number}%` }]} />
        <View style={[styles.sliderThumb, { left: `${progress * 100}%` as `${number}%` }]} />
      </View>
      <Text style={styles.sliderQuestionHint}>Drag or tap the bar, or use the buttons above.</Text>
    </View>
  );
}
