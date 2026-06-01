"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoversModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const cover_page_entity_1 = require("./entities/cover-page.entity");
const user_entity_1 = require("../users/entities/user.entity");
const covers_service_1 = require("./covers.service");
const covers_controller_1 = require("./covers.controller");
const auth_module_1 = require("../auth/auth.module");
let CoversModule = class CoversModule {
};
exports.CoversModule = CoversModule;
exports.CoversModule = CoversModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([cover_page_entity_1.CoverPage, user_entity_1.User]),
            auth_module_1.AuthModule,
        ],
        providers: [covers_service_1.CoversService],
        controllers: [covers_controller_1.CoversController],
        exports: [covers_service_1.CoversService],
    })
], CoversModule);
//# sourceMappingURL=covers.module.js.map