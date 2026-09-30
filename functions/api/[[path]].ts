import { Env, HttpError, errorResponse, parseId } from "../../server/http";
import { categories } from "../../server/categories";
import { summary } from "../../server/summary";
import { transactions } from "../../server/transactions";
import { wallets } from "../../server/wallets";

// Единая точка входа для всех /api/*. Один файл — проще следить за маршрутами.
export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const parts = ([] as string[]).concat((params.path as string[] | string | undefined) ?? []);
    const [resource, idPart, ...rest] = parts;
    if (rest.length) throw new HttpError(404, "Не найдено");

    const url = new URL(request.url);
    const method = request.method;
    const id = idPart === undefined ? undefined : parseId(idPart);
    const notAllowed = () => new HttpError(405, "Метод не поддерживается");

    const crud = {
      wallets: {
        list: () => wallets.list(env), create: () => wallets.create(env, request),
        get: (i: number) => wallets.get(env, i), update: (i: number) => wallets.update(env, i, request),
        replace: null, remove: (i: number) => wallets.remove(env, i),
      },
      categories: {
        list: () => categories.list(env, url), create: () => categories.create(env, request),
        get: (i: number) => categories.get(env, i), update: (i: number) => categories.update(env, i, request),
        replace: null, remove: (i: number) => categories.remove(env, i),
      },
      transactions: {
        list: () => transactions.list(env, url), create: () => transactions.create(env, request),
        get: (i: number) => transactions.get(env, i), update: null,
        replace: (i: number) => transactions.replace(env, i, request), remove: (i: number) => transactions.remove(env, i),
      },
    } as const;

    if (resource === "summary" && id === undefined) {
      if (method !== "GET") throw notAllowed();
      return await summary(env, url);
    }

    const h = crud[resource as keyof typeof crud];
    if (!h) throw new HttpError(404, "Не найдено");

    if (id === undefined) {
      if (method === "GET") return await h.list();
      if (method === "POST") return await h.create();
      throw notAllowed();
    }
    if (method === "GET") return await h.get(id);
    if (method === "PATCH" && h.update) return await h.update(id);
    if (method === "PUT" && h.replace) return await h.replace(id);
    if (method === "DELETE") return await h.remove(id);
    throw notAllowed();
  } catch (e) {
    return errorResponse(e);
  }
};
