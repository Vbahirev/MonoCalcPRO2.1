export function useHaptics() {
    // Taptic Engine style vibrations
    const impactLight = () => {
        if (navigator.vibrate) navigator.vibrate(10); // Очень короткий "тук"
    };

    const impactMedium = () => {
        if (navigator.vibrate) navigator.vibrate(15);
    };

    const notificationSuccess = () => {
        if (navigator.vibrate) navigator.vibrate([10, 30, 10]); // Тук-тук
    };

    const notificationError = () => {
        if (navigator.vibrate) navigator.vibrate([10, 50, 10, 50, 10]); // Дрр-дрр
    };

    return { impactLight, impactMedium, notificationSuccess, notificationError };
}