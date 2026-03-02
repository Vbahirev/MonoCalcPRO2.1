// Backward-compatibility shim.
// The Laser calculator module was moved into src/calculators/laser to support scaling to many calculators.
// Keep this file so existing imports keep working.

export { useLaserCalculator } from '@/calculators/laser/useCalculator';
