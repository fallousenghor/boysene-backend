import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  meta?: unknown;
  summary?: unknown;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const response = context.switchToHttp().getResponse();
    return next.handle().pipe(
      map((data) => {
        const isObject = data && typeof data === 'object' && !Array.isArray(data);
        return {
          success: true,
          statusCode: response.statusCode,
          message: data?.message || 'Success',
          data: data?.data !== undefined ? data.data : data,
          ...(isObject && data.meta !== undefined ? { meta: data.meta } : {}),
          ...(isObject && data.summary !== undefined ? { summary: data.summary } : {}),
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
