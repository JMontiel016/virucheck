import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let adminApp: App;

const serviceAccount = {
  type: "service_account",
  projectId: "virucheck-01",
  privateKeyId: "1a3fcf831d9ab0e9a0dc215ba68f611707798c65",
  privateKey:
    "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDKanAbJPOoDRKC\np6cp1QhtKU6yz+o8giZdPirB1KiW5WtpJ9Ez3nZ8zHD5oTWu8CEUJ8s6Cqu2GEWs\nihj64yPcBZ1Osineiiu8mhf16TkloJ9ogUKaGwghbqB/TRw2UWPPaUb0pxKex6f0\nW1sr19Sxubtx8FUva+n8Cd6udxGvii2VDJYc93t6cytg7BiRzznD7uxE2ob8vDGn\nII/pDC6sOHszBYMHjshfvPaVtYA2aIXrnhlXvhOAgdDlYZHelg3vaHCn3yYWxwaz\ndE/fyh4i9rzldDO80coEU3CO+MZ6sf4awqJGFESIyiJbyZNwKoKU535MAX0BjzVM\nW271XqwLAgMBAAECggEAWCiedfwUkSNMZhJd6IbLujuM9q0+cCchTWgXmD8mRD5c\nlzqLz6L7CSTDqb2QU4ZracthJIDkQ5Vztw+YjKDkC954In/PY4jbPrQAbo6q4JwC\nAbKWjubqFiGIDpnHiVLOfVX1XPXtUrFTkcY+QaypitSBcsEBYPuHt8mWrnbWgZSO\n9d4z8bBbBWYHrcQhlhxcbxITvDWg4Ohdifr+nLxl/CdgmdhKDVlL5PEuQSurulBA\n2kMVxwVKH/DKNXlbdvWjIPLHWrbq99KMKXY8kjbWQxhD67YyIP9rAdHLIBCytFhD\nVFPcRdT1aKhKwTl/xef/m5IqAgQDeJjkDYCAa0VVLQKBgQDvb1rJVFHfX5vDtMgF\nMB5h8lH8580HJxp3IVAnzdwAwBMGVWezrFA5rZ1uf6c9YukqPaUWVizmlvhTMhhS\nxFmZFfrOunChGwJkTAxNtZl8DH/yIIOCIfNbKS67r+ScZnbJDoZvgNyEMwozhQp8\nMx5repMmG2QqAUOyZPdxEH0LRwKBgQDYa28nm2IiyDUNOWe6eyPgRJshKhtcG2pg\n2rd0aMbjeOT4Am4DCacBZ3iRN7rH2d62ap0DpqL7S4M9Csjpt4wjf1MJlF6SRL8v\nnfkhvDz6l5dzoimrVqpcPmOZuovL3Jt2g7X7+6I58id92ssnXqDa5RfJYzh6wjpU\nkC6rLoDzHQKBgF5h/N2kGWn+HD63QqmY4EEn7l3NWirZpTsUrK4kHfdFv7odbHWN\nFUrHP2nRdDFkjhkSl8MIUUbMeDMDakcmE1OfMHDRWZiINxcmSytOzKPzoXPmkTB5\nBZ8Hyt49ZdapJWX4DdJib4rFO943MXzoAbPIa7z3yzIrsW3fExNEtqX9AoGBAKmq\nmEsRyz7/fG/wqDyPW5Hv1zqJ20c7iwuBjL+rgPlGhyNULFEfWRmFuAUJDtqtGKgk\nLxJ0qmOeULYjZV2tcyVFJaFl+zpqwQQgsfbbr2a6P5b88/QKjqagls8na3+YZRzl\np190aDtLd+B4DjrAOhVB84MD0XyUFszC+INlgtyVAoGAOtODFcEOqe2a0Yf+6mXe\nei3jC8nLcjOAYyfIdrc4kOUI19TF1sS4C5YQ83/dEDlGb9l6TC+3peL+SCxC69Si\n/y8xyQ9/wuot3hReTtgPO20uDgPuafVwPSmFWkRESd8t/76xb40THxNbFAZ4hq0/\n1TCQryh+kNS+zzoqlA3o39Y=\n-----END PRIVATE KEY-----\n",
  clientEmail: "firebase-adminsdk-fbsvc@virucheck-01.iam.gserviceaccount.com",
};

if (!getApps().length) {
  adminApp = initializeApp({
    credential: cert(serviceAccount),
    projectId: "virucheck-01",
  });
} else {
  adminApp = getApps()[0];
}

export const adminAuth = getAuth(adminApp);