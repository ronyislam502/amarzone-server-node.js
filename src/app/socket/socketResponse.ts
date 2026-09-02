

type TSocketResponse<T> = {
    statusCode: number;
    success: boolean;
    message: string;
    data?: T | null;
};

export const sendSocketResponse = <T>(
    callback: ((response: TSocketResponse<T>) => void) | undefined,
    response: TSocketResponse<T>
) => {
    if (typeof callback === "function") {
        callback(response);
    }
};