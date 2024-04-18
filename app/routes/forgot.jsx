import { auth } from "~/firebase-service";
import { sendPasswordResetEmail } from "firebase/auth";
import { Form, Link } from "@remix-run/react";
import { redirect } from "@remix-run/node";

//create a stylesheet ref for the auth.css file
export const links = () => {
  return [];
};

export const action = async ({ request }) => {
  // pull in the form data from the request after the form is submitted
  const formData = await request.formData();
  const email = formData.get("email");

  // perform firebase send password reset email
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err) {
    console.log("Error: ", err.message);
  }
  // success, send user to /login page
  return redirect("/login");
};

export default function Login() {
  return (
    <div className="ui container" style={{ paddingTop: 40 }}>
      <h3>Forgot Password?</h3>

      <Form method="post" className="ui form centered">
        <p>Enter the email address associated with your account</p>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            name="email"
            placeholder="me@mail.com"
            required
          />
        </div>
        <button className="ui button" type="submit">
          Request Password Reset Link
        </button>
      </Form>
      <div className="ui divider"></div>
      <div className="ui centered grid" style={{paddingTop:16}}>
        <div className="ui button">
          <Link to="/register">Not Yet Registered?</Link>
        </div>
      </div>
    </div>
  );
}
