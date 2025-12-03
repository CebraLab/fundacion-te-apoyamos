export class QueueException extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly errorDetails: any;
  public readonly timestamp: Date;

  constructor(
    message: string,
    errorCode: string = 'DEFAULT_QUEUE_ERROR',
    statusCode: number = 500,
    errorDetails?: any,
  ) {
    super(message);
    this.name = 'QueueException';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.errorDetails = errorDetails;
    this.timestamp = new Date();
  }

  /**
   * Crea una excepción desde un error existente
   * @param error - Error original
   * @param errorCode - Código de error personalizado
   * @param statusCode - Código de estado HTTP
   * @returns QueueException
   */
  static fromError(
    error: any,
    errorCode: string = 'SALES_QUEUE_ERROR',
    statusCode: number = 500,
  ): QueueException {
    let message: string;
    let errorDetails: any;

    // Verificar si es un error de Axios (tiene response)
    if (error.isAxiosError && error.response) {
      // Es un error de Axios con response
      const axiosResponse = error.response;

      try {
        // Extraer información del response de Axios
        const responseData = {
          status: axiosResponse.status,
          statusText: axiosResponse.statusText,
          headers: axiosResponse.headers,
          data: axiosResponse.data,
          url: axiosResponse.config?.url,
          method: axiosResponse.config?.method,
        };

        // Convertir a JSON string para el message
        message = JSON.stringify(responseData, null, 2);

        // Guardar detalles completos del error de Axios
        errorDetails = {
          isAxiosError: true,
          response: responseData,
          request: {
            url: axiosResponse.config?.url,
            method: axiosResponse.config?.method,
            headers: axiosResponse.config?.headers,
            data: axiosResponse.config?.data,
          },
          originalError: error.message,
        };

        // Actualizar statusCode con el código real de la respuesta
        statusCode = axiosResponse.status || statusCode;
      } catch (parseError) {
        // Si falla el parsing, usar información básica
        message = `Axios Error: ${axiosResponse.status} - ${axiosResponse.statusText}`;
        errorDetails = {
          isAxiosError: true,
          status: axiosResponse.status,
          statusText: axiosResponse.statusText,
          parseError: parseError.message,
        };
        statusCode = axiosResponse.status || statusCode;
      }
    } else if (error.response && error.response.data) {
      // Error con response pero no es Axios (fallback para otros tipos de errores HTTP)
      try {
        if (typeof error.response.data === 'string') {
          errorDetails = JSON.parse(error.response.data);
          message =
            errorDetails.message ||
            errorDetails.error ||
            error.message ||
            'Unknown error';
        } else {
          errorDetails = error.response.data;
          message =
            errorDetails.message ||
            errorDetails.error ||
            error.message ||
            'Unknown error';
        }
      } catch (parseError) {
        errorDetails = {
          rawResponse: error.response.data,
          parseError: parseError.message,
        };
        message = error.message || 'Unknown error';
      }
    } else {
      // No es error de Axios ni tiene response - error genérico
      message = error.message || error.toString() || 'Unknown error';
      errorDetails = {
        isAxiosError: false,
        originalError: error.toString(),
        stack: error.stack,
        name: error.name,
      };
    }

    return new QueueException(message, errorCode, statusCode, errorDetails);
  }

  /**
   * Convierte la excepción a un objeto serializable
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      errorDetails: this.errorDetails,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}
