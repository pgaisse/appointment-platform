import { useAuth0 } from "@auth0/auth0-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";


const AUDIENCE = (window as any).__ENV__?.AUTH0_AUDIENCE ?? import.meta.env.VITE_AUTH0_AUDIENCE;
const BASE_URL = (window as any).__ENV__?.VITE_BASE_URL ?? import.meta.env.VITE_BASE_URL;


export type MessageTemplateCategory = "message" | "confirmation";


export type MessageTemplateInput = {
title: string;
content: string;
category?: MessageTemplateCategory; // default "message" on server
variablesUsed?: string[]; // optional, server will uniq/sanitize
};


export type MessageTemplate = {
_id: string;
title: string;
content: string;
category: MessageTemplateCategory;
variablesUsed: string[];
org_id: string;
created_by: string;
createdAt: string;
updatedAt: string;
};


export function useCreateMessageTemplate() {
const { getAccessTokenSilently, isAuthenticated } = useAuth0();
const queryClient = useQueryClient();


return useMutation({
mutationKey: ["MessageTemplate", "create"],
mutationFn: async (payload: MessageTemplateInput) => {
if (!isAuthenticated) throw new Error("Not authenticated");


const token = await getAccessTokenSilently({
authorizationParams: { audience: AUDIENCE },
detailedResponse: false,
});


const res = await axios.post(
`${BASE_URL}/message-templates`,
payload,
{
headers: {
Authorization: `Bearer ${token}`,
"Content-Type": "application/json",
},
withCredentials: false,
}
);


// Endpoint returns { ok, message, document }
return res.data as { ok: boolean; message: string; document: MessageTemplate };
},
onSuccess: () => {
// Keep your existing query keys consistent with the component usage
queryClient.invalidateQueries({ queryKey: ["MessageTemplate"] });
},
});
}