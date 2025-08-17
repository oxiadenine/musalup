import { useLoaderData } from "react-router";
import { Helmet } from "react-helmet-async";
import "./home.css";

export function Home() {
  const data = useLoaderData();

  return (
    <div className="home">
      <Helmet>
        <title>{process.env.PUBLIC_SITE_NAME}</title>
      </Helmet>
      <h1>{process.env.PUBLIC_SITE_NAME}</h1>
      <h3>{data}</h3>
    </div>
  );
}

export default Home;
