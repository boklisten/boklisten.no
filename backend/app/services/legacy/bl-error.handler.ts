import logger from "@adonisjs/core/services/logger";

import { BlError } from "#shared/bl-error";
import { BlapiErrorResponse } from "#shared/blapi-error-response";

function createBlapiErrorResponse(error: unknown): BlapiErrorResponse {
  const blError =
    error instanceof BlError
      ? error
      : error instanceof Error
        ? new BlError(`unknown error: ${error.message}, stack:\n${error.stack}`).store(
            "error",
            error,
          )
        : new BlError(`unknown error: ${error}`).store("error", error);

  printErrorStack(blError);

  const blErrorResponse = getErrorResponse(blError);

  return new BlapiErrorResponse(
    blErrorResponse.httpStatus,
    blErrorResponse.code,
    blErrorResponse.msg,
    blErrorResponse.data,
  );
}

function printErrorStack(blError: unknown) {
  printError(blError);
}

function printError(error: unknown) {
  if (error instanceof BlError) {
    if (error.errorStack && error.errorStack.length > 0) {
      for (const error_ of error.errorStack) {
        printError(error_);
      }
    }

    logger.info(
      `! (${error.getCode()}): ${error.getMsg()}` + (error.stack ? `, stack:\n${error.stack}` : ""),
    );

    if (error.getStore() && error.getStore().length > 0) {
      for (const storeData of error.getStore()) {
        logger.info(`! (${error.getCode()}) ${JSON.stringify(storeData.value)}`);
      }
    }
  } else if (error instanceof Error) {
    logger.info(`! (err) ${error.message}\n${error.stack}`);
  } else {
    logger.info(`! (???) ${error}`);
  }
}

function getErrorResponse(blError: BlError): BlapiErrorResponse {
  const blapiErrorResponse: BlapiErrorResponse = {
    httpStatus: 500,
    code: blError.getCode(),
    msg: "server error",
    data: null,
  };

  if (!blError.getCode() || blError.getCode() === 0) return blapiErrorResponse;
  else if (blError.getCode() >= 200 && blError.getCode() <= 299)
    return serverErrorResponse(blError.getCode());
  else if (blError.getCode() >= 700 && blError.getCode() <= 799)
    return documentErrorResponse(blError.getCode());
  else if (blError.getCode() >= 800 && blError.getCode() <= 899)
    return requestErrorResponse(blError.getCode());
  else if (blError.getCode() >= 900 && blError.getCode() <= 999)
    return authErrorResponse(blError.getCode());
  else if (blError.getCode() >= 10_000 && blError.getCode() <= 11_000) {
    return fakeSuccessResponse(blError);
  } else return blapiErrorResponse;
}

function serverErrorResponse(code: number): BlapiErrorResponse {
  const blapiErrorResponse: BlapiErrorResponse = {
    httpStatus: 500,
    code: code,
    msg: "server error",
    data: null,
  };

  switch (code) {
    case 200: {
      blapiErrorResponse.msg = "server error";
      break;
    }
  }

  return blapiErrorResponse;
}

function requestErrorResponse(code: number): BlapiErrorResponse {
  const blapiErrorResponse: BlapiErrorResponse = {
    httpStatus: 500,
    code: code,
    msg: "server error",
    data: null,
  };

  switch (code) {
    case 800: {
      blapiErrorResponse.msg = "server error";
      break;
    }
    case 801: {
      blapiErrorResponse.msg =
        "En eller flere av bøkene du prøver å dele ut er allerede aktiv på en annen kunde. Prøv å dele ut én og én bok for å finne ut hvilke bøker dette gjelder.";
      blapiErrorResponse.httpStatus = 409;
      break;
    }
    case 802: {
      blapiErrorResponse.msg =
        "Ordren inneholder bøker som er låst til en overlevering; kunden må overlevere de låste bøkene til en annen elev";
      blapiErrorResponse.httpStatus = 409;
      break;
    }
    case 803: {
      blapiErrorResponse.msg = "invalid blid";
      blapiErrorResponse.httpStatus = 400;
      break;
    }
    case 804: {
      blapiErrorResponse.msg = "Boken du har scannet er ikke aktiv. Ta kontakt med stand for hjelp";
      blapiErrorResponse.httpStatus = 404;
      break;
    }
    case 805: {
      blapiErrorResponse.msg = "Boken du har scannet er ikke i din bokliste";
      blapiErrorResponse.httpStatus = 409;
      break;
    }
    case 806: {
      blapiErrorResponse.msg = "Du har allerede mottatt denne boka";
      blapiErrorResponse.httpStatus = 409;
      break;
    }
    case 807: {
      blapiErrorResponse.msg =
        "Ordren inneholder bøker som er låst til en overlevering; kunden må motta de låste bøkene fra en annen elev";
      blapiErrorResponse.httpStatus = 409;
      break;
    }
    case 808: {
      blapiErrorResponse.msg = "Kan ikke sende e-post-påminnelse med egendefinert tekst, bare SMS";
      blapiErrorResponse.httpStatus = 400;
      break;
    }
    case 809: {
      blapiErrorResponse.msg =
        "Noen av bøkene i handlekurven har utgått frist og kan derfor ikke deles ut/samles inn. Ta kontakt med administrator for mer informasjon";
      blapiErrorResponse.httpStatus = 400;
      break;
    }
    case 810: {
      blapiErrorResponse.msg =
        "Noen av bøkene i handlekurven har frist mer enn to år i fremtiden og kan derfor ikke deles ut/samles inn. Ta kontakt med administrator for mer informasjon";
      blapiErrorResponse.httpStatus = 400;
      break;
    }
    case 811: {
      blapiErrorResponse.msg =
        "Kunden har ikke en gyldig underskrift på låneavtalen, be foreldre sjekke e-post";
      blapiErrorResponse.httpStatus = 409;
      break;
    }
    case 812: {
      blapiErrorResponse.msg =
        "Forsørger prøvde å signere for myndig, eller mindreårig prøve å signere for seg" + " selv";
      blapiErrorResponse.httpStatus = 409;
      break;
    }
    case 813: {
      blapiErrorResponse.msg = "Forsørger har allerede signert";
      blapiErrorResponse.httpStatus = 409;
      break;
    }
    case 814: {
      blapiErrorResponse.msg =
        "Orderen inneholder en eller flere bøker med lik blid. Sjekk at du ikke har skannet samme bok to ganger";
      blapiErrorResponse.httpStatus = 400;
      break;
    }
  }

  return blapiErrorResponse;
}

function documentErrorResponse(code: number): BlapiErrorResponse {
  const blapiErrorResponse: BlapiErrorResponse = {
    httpStatus: 400,
    code: code,
    msg: "bad format",
    data: null,
  };

  switch (code) {
    case 701: {
      blapiErrorResponse.httpStatus = 400;
      blapiErrorResponse.msg = "bad format";
      break;
    }
    case 702: {
      blapiErrorResponse.httpStatus = 404;
      blapiErrorResponse.msg = "not found";
      break;
    }
  }
  return blapiErrorResponse;
}

function authErrorResponse(code: number): BlapiErrorResponse {
  const blapiErrorResponse: BlapiErrorResponse = {
    httpStatus: 401,
    code: code,
    msg: "authentication failure",
    data: null,
  };

  switch (code) {
    case 901: {
      blapiErrorResponse.msg = "password is wrong";
      break;
    }
    case 902: {
      blapiErrorResponse.msg = "user is not valid";
      break;
    }
    case 903: {
      blapiErrorResponse.httpStatus = 400;
      blapiErrorResponse.msg = "username already exists";
      break;
    }
    case 904: {
      blapiErrorResponse.httpStatus = 403;
      blapiErrorResponse.msg = "forbidden";
      break;
    }
    case 905: {
      blapiErrorResponse.msg = "invalid token";
      break;
    }
    case 906: {
      blapiErrorResponse.msg = "token creation failed";
      break;
    }
    case 907: {
      blapiErrorResponse.msg = "user creation failed";
      blapiErrorResponse.httpStatus = 400;
      break;
    }
    case 908: {
      blapiErrorResponse.msg = "username or password is wrong";
      break;
    }
    case 909: {
      blapiErrorResponse.msg = "refreshToken not valid";
      break;
    }
    case 910: {
      blapiErrorResponse.msg = "accessToken not valid";
      break;
    }
    case 911: {
      blapiErrorResponse.msg = "bruker kan ikke endre egen e-post-bekreftet-status";
      break;
    }
    case 912: {
      blapiErrorResponse.msg = "telefonnummer er allerede registrert på en annnen bruker";
      break;
    }
  }

  return blapiErrorResponse;
}

function fakeSuccessResponse(underlyingError: BlError): BlapiErrorResponse {
  return {
    httpStatus: 200,
    code: underlyingError.getCode(),
    msg:
      "returning fake success for security reasons, underlying error: " + underlyingError.getMsg(),
    data: [],
  };
}

const BlErrorHandler = {
  createBlapiErrorResponse,
};
export default BlErrorHandler;
