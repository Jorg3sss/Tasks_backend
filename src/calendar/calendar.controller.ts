import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { CalendarService }     from './calendar.service';
import { RegisterCalendarDto } from './dto/register-calendar.dto';
import { JwtAuthGuard }        from '../auth/guards/jwt-auth.guard';
import { GetUser }             from '../common/decorators/get-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  /**
   * POST /calendar/register
   * Registra o actualiza la URL del calendario .ics del usuario.
   * Body: { calendarUrl: string }
   */
  @Post('register')
  @HttpCode(HttpStatus.OK)
  registerCalendar(
    @GetUser('sub') userId: string,
    @Body() dto: RegisterCalendarDto,
  ) {
    return this.calendarService.registerCalendar(userId, dto);
  }

  /**
   * POST /calendar/sync
   * Re-sincroniza el calendario registrado: descarga el .ics y crea
   * las tareas nuevas que no existan aún (idempotente por externalEventId).
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  syncCalendar(@GetUser('sub') userId: string) {
    return this.calendarService.syncCalendar(userId);
  }
}
