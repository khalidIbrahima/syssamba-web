# Subscription Payments API Documentation

## Overview

The subscription payments system tracks all payment transactions for organization subscriptions, providing a complete audit trail and enabling refund management.

## Database Schema

### Table: `subscription_payments`

Stores individual payment transactions for subscriptions.

**Key Fields:**
- `subscription_id` - Links to the subscription
- `organization_id` - Links to the organization (denormalized for performance)
- `amount` - Payment amount in FCFA
- `currency` - Currency code (default: XOF)
- `payment_method` - Payment provider (stripe, paypal, wave, orange_money)
- `billing_period_start/end` - Period covered by this payment
- `status` - Payment status (pending, processing, completed, failed, refunded, disputed)
- `transaction_id` - External transaction ID from payment provider
- `gateway_response` - Full provider response (JSONB) for audit/debugging
- `refunded_amount` - Amount refunded (supports partial refunds)

## API Endpoints

### 1. GET `/api/organization/payments`

Get payment history for the current user's organization.

**Query Parameters:**
- `status` (optional) - Filter by status (pending, completed, failed, refunded, etc.)
- `payment_method` (optional) - Filter by payment method (stripe, paypal, wave, orange_money)
- `limit` (optional, default: 50) - Number of results per page
- `offset` (optional, default: 0) - Pagination offset

**Response:**
```json
{
  "payments": [
    {
      "id": "uuid",
      "subscriptionId": "uuid",
      "amount": 15000,
      "currency": "XOF",
      "paymentMethod": "stripe",
      "billingPeriodStart": "2024-01-01",
      "billingPeriodEnd": "2024-02-01",
      "status": "completed",
      "transactionId": "stripe_123456",
      "providerCustomerId": "cus_123",
      "providerSubscriptionId": "sub_123",
      "gatewayResponse": { ... },
      "failureReason": null,
      "refundReason": null,
      "refundedAt": null,
      "refundedAmount": null,
      "paidAt": "2024-01-01T10:00:00Z",
      "failedAt": null,
      "createdAt": "2024-01-01T10:00:00Z",
      "updatedAt": "2024-01-01T10:00:00Z",
      "planName": "Starter",
      "subscriptionStatus": "active"
    }
  ],
  "pagination": {
    "total": 10,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

**Example Usage:**
```bash
# Get all payments
GET /api/organization/payments

# Get only completed payments
GET /api/organization/payments?status=completed

# Get Stripe payments only
GET /api/organization/payments?payment_method=stripe

# Paginated results
GET /api/organization/payments?limit=10&offset=20
```

### 2. POST `/api/organization/payments/[id]/refund`

Process a refund for a subscription payment.

**Request Body:**
```json
{
  "reason": "Customer requested refund",
  "amount": 15000  // Optional: for partial refunds. If omitted, full refund
}
```

**Response:**
```json
{
  "success": true,
  "message": "Refund processed successfully",
  "refund": {
    "amount": 15000,
    "totalRefunded": 15000,
    "isFullRefund": true,
    "transactionId": "refund_123456"
  }
}
```

**Status Codes:**
- `200` - Refund processed successfully
- `400` - Invalid request (payment not refundable, amount exceeds limit, etc.)
- `401` - Unauthorized
- `403` - Payment does not belong to user's organization
- `404` - Payment not found
- `500` - Internal server error

**Business Rules:**
- Only `completed` payments can be refunded
- Partial refunds are supported (multiple refunds allowed)
- Full refund automatically cancels the subscription
- Refund amount cannot exceed payment amount minus already refunded amount

**Example Usage:**
```bash
# Full refund
POST /api/organization/payments/payment-uuid/refund
{
  "reason": "Customer cancellation"
}

# Partial refund
POST /api/organization/payments/payment-uuid/refund
{
  "reason": "Partial refund for unused period",
  "amount": 7500
}
```

## Payment Processing Flow

### 1. Initial Payment (Setup)

When a user completes setup with a paid plan:

1. User selects plan and payment method
2. Payment is processed via `/api/organization/payment`
3. Subscription is created/updated in `subscriptions` table
4. Payment record is created in `subscription_payments` table with status:
   - `completed` - Payment successful
   - `processing` - Payment pending
   - `failed` - Payment failed

### 2. Recurring Payments

For recurring subscriptions (monthly/yearly):

1. Payment provider webhook notifies of new payment
2. New payment record created in `subscription_payments`
3. Subscription `current_period_start/end` updated
4. Subscription status updated if payment fails

### 3. Refund Processing

1. Admin/user requests refund via API
2. Refund processed with payment provider
3. Payment record updated:
   - `refunded_amount` incremented
   - `refunded_at` set
   - `refund_reason` stored
   - Status set to `refunded` if full refund
4. Subscription canceled if full refund

## Payment Status Flow

```
pending → processing → completed
                    ↓
                  failed
                    ↓
              (retry or cancel)

completed → refunded (partial or full)
```

## Integration with Payment Providers

### Stripe
- `transaction_id`: Stripe payment intent ID
- `provider_customer_id`: Stripe customer ID
- `provider_subscription_id`: Stripe subscription ID
- `gateway_response`: Full Stripe payment intent object

### PayPal
- `transaction_id`: PayPal order ID
- `provider_customer_id`: PayPal payer ID
- `provider_subscription_id`: PayPal subscription ID
- `gateway_response`: Full PayPal order object

### Wave
- `transaction_id`: Wave transaction ID
- `provider_customer_id`: Wave merchant/customer ID
- `gateway_response`: Wave transaction response

### Orange Money
- `transaction_id`: Orange Money transaction ID
- `provider_customer_id`: Phone number
- `gateway_response`: Orange Money transaction response

## Error Handling

All payment operations include comprehensive error handling:

- **Validation errors**: Invalid data format, missing required fields
- **Business logic errors**: Payment not refundable, amount exceeds limit
- **Provider errors**: Payment gateway failures, network issues
- **Database errors**: Transaction failures, constraint violations

All errors are logged with full context for debugging.

## Security Considerations

1. **Authorization**: All endpoints verify user authentication and organization ownership
2. **Data validation**: All inputs validated with Zod schemas
3. **Audit trail**: Complete payment history stored for compliance
4. **Idempotency**: Refund operations are idempotent (can be safely retried)

## Future Enhancements

1. **Webhook handlers**: Automatic payment status updates from providers
2. **Retry logic**: Automatic retry for failed payments
3. **Dunning management**: Handle past_due subscriptions
4. **Payment methods**: Support for additional payment providers
5. **Analytics**: Payment trends, revenue reports
6. **Notifications**: Email/SMS notifications for payment events

