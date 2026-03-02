import { computed } from 'vue';
import { getCalculator } from './calculators/registry';

// Generic accessor for calculator modules.
// Returns the module's composable (use()) result.
export function useCalculator(calculatorId = 'laser') {
  const module = computed(() => getCalculator(calculatorId));
  // NOTE: module.value.use is a composable. It can keep its own singleton state if implemented that way.
  return module.value.use();
}
