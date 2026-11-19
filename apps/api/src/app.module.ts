import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { DanfseController } from "./danfse.controller.js";
import { HealthController } from "./health.controller.js";
import { RequestIdMiddleware } from "./request-id.middleware.js";

@Module({
  controllers: [DanfseController, HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
