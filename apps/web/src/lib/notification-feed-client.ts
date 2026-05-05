export function notificationPatchRequestInit(): RequestInit {
  return {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "locateflow",
    },
    credentials: "same-origin",
    body: "{}",
  };
}
