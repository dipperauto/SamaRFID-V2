// Update this page (the content is just a fallback if you fail to update the page)

import { MadeWithDyad } from "@/components/made-with-dyad";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6 text-center">
      <div>
        <h1 className="text-4xl font-bold mb-4">Welcome to Your Blank App</h1>
        <p className="text-xl text-gray-600 mb-6">
          Start building your amazing project here!
        </p>
        <Button asChild className="bg-blue-600 hover:bg-blue-700">
          <Link to="/login">Ir para o Login</Link>
        </Button>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;