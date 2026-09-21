import router from "@adonisjs/core/services/router";
import server from "@adonisjs/core/services/server";

server.errorHandler(() => import("#exceptions/handler"));

server.use([
  () => import("#middleware/container_bindings_middleware"),
  () => import("#middleware/force_json_response_middleware"),
  () => import("@adonisjs/cors/cors_middleware"),
  () => import("@adonisjs/static/static_middleware"),
]);

router.use([
  () => import("#middleware/verify_origin_middleware"),
  () => import("@adonisjs/core/bodyparser_middleware"),
  () => import("@tuyau/superjson/superjson_middleware"),
  () => import("@adonisjs/session/session_middleware"),
  () => import("@adonisjs/auth/initialize_auth_middleware"),
  () => import("#middleware/initialize_bouncer_middleware"),
  () => import("@adonisjs/shield/shield_middleware"),
]);

export const middleware = router.named({
  auth: () => import("#middleware/auth_middleware"),
  can: () => import("#middleware/can_middleware"),
});
