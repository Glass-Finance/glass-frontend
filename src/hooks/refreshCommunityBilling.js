// Expiry and exemption schedule cancellation asynchronously. Refresh existing
// views after the successful action without claiming cancellation has finished.
export function refreshCommunityBilling(queryClient, communityId) {
  const keys = [
    ["community", communityId],
    ["member-record", communityId],
    ["obligations"],
    ["obligation"],
    ["payment-links"],
    ["payment-link"],
    ["admin-obligations"],
    ["admin-obligation"],
    ["admin-payment-links"],
  ];
  return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
