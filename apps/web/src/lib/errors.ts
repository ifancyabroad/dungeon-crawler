/**
 * Turn a caught error (from api calls / useMutation) into a user-facing message.
 * The api client already throws Error with the API's message, so this is just a safe fallback.
 */
export function getApiErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return "Something went wrong";
}
