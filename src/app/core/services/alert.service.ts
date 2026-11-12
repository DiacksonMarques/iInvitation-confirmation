import { Injectable } from '@angular/core';
import Swal, { SweetAlertOptions } from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class AlertService {
  success(message: string, dialog = false, title = 'Tudo certo!') {
    const dataAlert: SweetAlertOptions = { icon: 'success', title, text: message };
    if(dialog){
      const dialog = document.querySelector<HTMLDialogElement>('#dialog');
      dataAlert.target = dialog
    }

    return Swal.fire(dataAlert);
  }

  error(message: string, dialog = false, title = 'Não foi possível concluir') {
    const dataAlert: SweetAlertOptions = { icon: 'error', title, text: message };
    if(dialog){
      const dialog = document.querySelector<HTMLDialogElement>('#dialog');
      dataAlert.target = dialog
    }

    return Swal.fire(dataAlert);
  }

  info(message: string, dialog = false, title = 'Atenção') {
    const dataAlert: SweetAlertOptions = { icon: 'info', title, text: message };
    if(dialog){
      const dialog = document.querySelector<HTMLDialogElement>('#dialog');
      dataAlert.target = dialog
    }

    return Swal.fire(dataAlert);
  }

  confirm(message: string, dialog = false, title = 'Confirmar ação') {
    const dataAlert: SweetAlertOptions = {
      icon: 'question',
      title,
      text: message,
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#9b594c',
    };

    if(dialog){
      const dialog = document.querySelector<HTMLDialogElement>('#dialog');
      dataAlert.target = dialog
    }

    return Swal.fire(dataAlert);
  }
}
