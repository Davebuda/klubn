namespace DJDiP.Application.Interfaces
{
    // Post-fulfillment confirmation email (checkout-orchestration design §4.4). This is the
    // "OrderFulfillmentService" email half — issuance itself (tickets, counters, promo
    // consume) is transactional and STAYS in the orchestrator's capture transaction. The
    // orchestrator calls SendAsync AFTER that transaction commits.
    //
    // BEST-EFFORT by contract: SendAsync NEVER throws. It catches + logs every failure
    // internally (a skipped/failed email is recoverable — tickets are in the wallet; a
    // failed finalize is not). The orchestrator still wraps the call in try/catch (belt
    // and braces), but the guarantee lives here.
    public interface IOrderConfirmationService
    {
        Task SendAsync(Guid orderId, CancellationToken ct);
    }
}
