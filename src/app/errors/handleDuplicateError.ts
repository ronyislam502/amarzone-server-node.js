/* eslint-disable @typescript-eslint/no-explicit-any */
import { TErrorSources, TGenericErrorResponse } from "../interface/error";

const handleDuplicateError = (error: any): TGenericErrorResponse => {
  const match = error.message.match(/"([^"]*)"/);
  const errorMessage = match && match[1];

  const errorSources: TErrorSources = [
    {
      path: "",
      message: `${errorMessage} is already exists`,
    },
  ];
  const statusCode = 400;

  return {
    statusCode,
    message: "Invalid Id",
    errorSources,
  };
};

export default handleDuplicateError;
