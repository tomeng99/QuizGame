import { Pressable, Text, View } from "react-native";
import type { RankingItem } from "@quizgame/contracts";
import { styles } from "../styles";

interface RankingQuestionProps {
  items: RankingItem[];
  selectedOrder: string[];
  disabled: boolean;
  onOrderChange: (order: string[]) => void;
}

export function RankingQuestion({
  items,
  selectedOrder,
  disabled,
  onOrderChange,
}: RankingQuestionProps) {
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const orderedItems = selectedOrder
    .map((itemId) => itemMap.get(itemId))
    .filter((item): item is RankingItem => item !== undefined);

  const handlePress = (itemId: string) => {
    if (disabled) {
      return;
    }

    const existingIndex = selectedOrder.indexOf(itemId);
    if (existingIndex >= 0) {
      onOrderChange(selectedOrder.slice(0, existingIndex));
      return;
    }

    onOrderChange([...selectedOrder, itemId]);
  };

  return (
    <View style={styles.rankingQuestionCard}>
      <Text style={styles.rankingQuestionTitle}>Tap items in the right order</Text>
      <View style={styles.rankingQuestionList}>
        {items.map((item) => {
          const selectedIndex = selectedOrder.indexOf(item.id);
          const isSelected = selectedIndex >= 0;

          return (
            <Pressable
              key={item.id}
              disabled={disabled}
              onPress={() => handlePress(item.id)}
              style={[
                styles.rankingChoiceCard,
                isSelected && styles.rankingChoiceCardSelected,
                disabled && styles.rankingChoiceCardDisabled,
              ]}
            >
              <View style={styles.rankingChoiceBadge}>
                <Text style={styles.rankingChoiceBadgeText}>
                  {isSelected ? selectedIndex + 1 : "•"}
                </Text>
              </View>
              <Text style={styles.rankingChoiceText}>{item.text}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.rankingSelectedCard}>
        <View style={styles.rankingSelectedHeader}>
          <Text style={styles.rankingSelectedTitle}>Your order</Text>
          <Pressable
            disabled={disabled || selectedOrder.length === 0}
            onPress={() => onOrderChange([])}
            style={[
              styles.correctToggle,
              (disabled || selectedOrder.length === 0) && styles.disabledButton,
            ]}
          >
            <Text style={styles.correctToggleText}>Clear</Text>
          </Pressable>
        </View>
        {orderedItems.length === 0 ? (
          <Text style={styles.rankingSelectedHint}>Tap the first item to begin.</Text>
        ) : (
          orderedItems.map((item, index) => (
            <Text key={item.id} style={styles.rankingSelectedItem}>
              {index + 1}. {item.text}
            </Text>
          ))
        )}
      </View>
    </View>
  );
}
