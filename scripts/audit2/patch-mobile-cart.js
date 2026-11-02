const fs = require('fs');
const path = require('path');

const filePath = path.resolve('mobile/src/context/CartContext.js');
let content = fs.readFileSync(filePath, 'utf8');

const targetBlock = `  const storageKey = userId ? \`@marketplace_cart_user_\${userId}\` : null;

  useEffect(() => {
    let isMounted = true;
    setIsLoaded(false);

    const loadSavedCart = async () => {
      try {
        if (!storageKey) {
          if (isMounted) {
            setItems({});
            setIsLoaded(true);
          }
          return;
        }

        const raw = await AsyncStorage.getItem(storageKey);
        if (raw && isMounted) {
          try {
            const parsed = JSON.parse(raw);
            const sanitized = sanitizeCartItems(parsed);
            setItems(sanitized);
          } catch {
            setItems({});
          }
        } else if (isMounted) {
          setItems({});
        }
      } catch (err) {
        console.error('Failed to load cart from AsyncStorage', err);
        if (isMounted) setItems({});
      } finally {
        if (isMounted) setIsLoaded(true);
      }
    };

    loadSavedCart();
    return () => {
      isMounted = false;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!isLoaded || !storageKey) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(items)).catch((err) => {
      console.error('Failed to persist cart to AsyncStorage', err);
    });
  }, [items, isLoaded, storageKey]);`;

const replacementBlock = `  const GUEST_KEY = '@marketplace_cart_guest';
  const storageKey = userId ? \`@marketplace_cart_user_\${userId}\` : GUEST_KEY;

  useEffect(() => {
    let isMounted = true;
    setIsLoaded(false);

    const loadAndMergeCart = async () => {
      try {
        if (!userId) {
          // Guest mode: load guest cart
          const rawGuest = await AsyncStorage.getItem(GUEST_KEY);
          if (rawGuest && isMounted) {
            try {
              const parsed = JSON.parse(rawGuest);
              setItems(sanitizeCartItems(parsed));
            } catch {
              setItems({});
            }
          } else if (isMounted) {
            setItems({});
          }
        } else {
          // Authenticated mode: check if guest cart needs to be merged into user cart
          const userKey = \`@marketplace_cart_user_\${userId}\`;
          const [rawUser, rawGuest] = await Promise.all([
            AsyncStorage.getItem(userKey),
            AsyncStorage.getItem(GUEST_KEY),
          ]);

          let userItems = {};
          if (rawUser) {
            try {
              userItems = sanitizeCartItems(JSON.parse(rawUser));
            } catch {}
          }

          let guestItems = {};
          if (rawGuest) {
            try {
              guestItems = sanitizeCartItems(JSON.parse(rawGuest));
            } catch {}
          }

          if (Object.keys(guestItems).length > 0) {
            // Merge guest items into user cart
            const merged = { ...userItems };
            Object.entries(guestItems).forEach(([key, gItem]) => {
              if (merged[key]) {
                const maxStock = gItem.selectedVariant?.stock ?? gItem.product?.stock ?? 99;
                merged[key] = {
                  ...merged[key],
                  quantity: Math.min(maxStock, merged[key].quantity + gItem.quantity),
                };
              } else {
                merged[key] = gItem;
              }
            });

            // Save merged to user cart and purge guest cart
            await Promise.all([
              AsyncStorage.setItem(userKey, JSON.stringify(merged)),
              AsyncStorage.removeItem(GUEST_KEY),
            ]);

            if (isMounted) setItems(merged);
          } else {
            if (isMounted) setItems(userItems);
          }
        }
      } catch (err) {
        console.error('Failed to load or merge cart from AsyncStorage', err);
        if (isMounted) setItems({});
      } finally {
        if (isMounted) setIsLoaded(true);
      }
    };

    loadAndMergeCart();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!isLoaded || !storageKey) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(items)).catch((err) => {
      console.error('Failed to persist cart to AsyncStorage', err);
    });
  }, [items, isLoaded, storageKey]);`;

content = content.replace(targetBlock, replacementBlock);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched CartContext.js with guest cart persistence and merge');
