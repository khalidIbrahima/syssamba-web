import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
export const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2025-11-17.clover',
}) : null;

/**
 * Get or create a Stripe Price for a plan
 * This function creates a Product and Price in Stripe if they don't exist
 * 
 * @param planName - The plan name (e.g., "starter", "pro")
 * @param planDisplayName - The display name of the plan
 * @param amount - Price amount in the smallest currency unit (for XOF, this is the same as FCFA since it's zero-decimal)
 * @param interval - 'month' or 'year'
 * @returns The Stripe Price ID
 */
export async function getOrCreateStripePrice(
  planName: string,
  planDisplayName: string,
  amount: number,
  interval: 'month' | 'year'
): Promise<string> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  // Search for existing product by metadata (one product per plan, not per interval)
  let product: Stripe.Product;
  try {
    const productSearch = await stripe.products.search({
      query: `metadata['plan_name']:'${planName}' AND active:'true'`,
      limit: 1,
    });
    
    if (productSearch.data.length > 0) {
      product = productSearch.data[0];
    } else {
      // Create new product (one product per plan name, regardless of interval)
      product = await stripe.products.create({
        name: planDisplayName,
        description: `Plan ${planDisplayName}`,
        metadata: {
          plan_name: planName,
        },
      });
    }
  } catch (error: any) {
    // If search fails, try to create product (might fail if it exists, but that's OK)
    // In case of error, we'll list products and filter manually
    const allProducts = await stripe.products.list({ limit: 100, active: true });
    const existingProduct = allProducts.data.find(
      p => p.metadata?.plan_name === planName && p.active
    );
    
    if (existingProduct) {
      product = existingProduct;
    } else {
      product = await stripe.products.create({
        name: planDisplayName,
        description: `Plan ${planDisplayName}`,
        metadata: {
          plan_name: planName,
        },
      });
    }
  }

  // Search for existing price for this product and interval
  let priceSearch;
  try {
    priceSearch = await stripe.prices.search({
      query: `product:'${product.id}' AND metadata['interval']:'${interval}' AND active:'true'`,
      limit: 1,
    });
  } catch (error: any) {
    // If search fails, list prices and filter manually
    const allPrices = await stripe.prices.list({ 
      limit: 100,
      active: true,
      product: product.id,
    });
    priceSearch = {
      data: allPrices.data.filter(
        p => p.metadata?.interval === interval && p.active && p.recurring?.interval === interval
      ),
    };
  }

  if (priceSearch.data.length > 0) {
    const existingPrice = priceSearch.data[0];
    // Verify the amount matches (with some tolerance for rounding)
    const existingAmount = existingPrice.unit_amount || 0;
    if (Math.abs(existingAmount - amount) < 100) {
      // Amount is close enough, return existing price
      return existingPrice.id;
    }
    // Amount changed, deactivate old price and create new one
    await stripe.prices.update(existingPrice.id, { active: false });
  }

  // Create new price
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amount,
    currency: 'xof',
    recurring: {
      interval: interval,
    },
    metadata: {
      plan_name: planName,
      interval: interval,
    },
  });

  return price.id;
}
