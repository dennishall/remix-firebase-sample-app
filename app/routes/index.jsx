import { useLoaderData, Form, useFetcher } from "@remix-run/react";
import { json } from "@remix-run/node";

import { auth } from "~/firebase-service";
import { isSessionValid, sessionLogout } from "~/fb.sessions.server";

// use loader to check for existing session
export async function loader({ request }) {
  const { decodedClaims, error } = await isSessionValid(request, "/login");

  const COLLECTION_NAME = "invoices";
  const PROJECT_ID = decodedClaims.aud;

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION_NAME}`
  );
  const { documents } = await response.json();

  console.log("documents", JSON.stringify(documents));

  const data = {
    error,
    decodedClaims,
    responseData: documents,
  };
  return json(data);
}

export async function action({ request }) {
  return await sessionLogout(request);
}

// https://remix.run/api/conventions#meta
export const meta = () => {
  return {
    title: "Remix Starter Firebase ",
    description: "Welcome to remix with firebase!",
  };
};

// https://remix.run/guides/routing#index-routes
export default function Index() {
  const logoutFetcher = useFetcher();
  const data = useLoaderData();
  const greeting = data?.decodedClaims
    ? "Logged In As: " + data?.decodedClaims?.email
    : "Log In My: friend";

  console.log(data);

  const logout = async () => {
    await auth.signOut();
    logoutFetcher.submit({}, { method: "POST" });
  };

  return (
    <div className="ui container centered" style={{ paddingTop: 40 }}>
      <div className="ui segment">
        <h3>{greeting}</h3>
        <div>
          <button className="ui button" type="button" onClick={() => logout()}>
            Log Out
          </button>
          <a href="/invoice">invoice</a>
        </div>
      </div>
      <div className="ui segment">
        <div className="ui medium header">User Authentication Information</div>
        <p>Name: {data?.decodedClaims?.name || "** Name Missing **"}</p>
        <p>Email: {data?.decodedClaims?.email}</p>
        <p>Login Using: {data?.decodedClaims?.firebase?.sign_in_provider}</p>
      </div>
      <div className="ui segment">
        <div className="ui medium header">Querying Firestore Database</div>
        {data?.responseData?.map((m) => (
          <div className="ui segment" key={m?.name}>
            {m?.name} :
            <pre>{JSON.stringify(m?.fields, null, 4)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
