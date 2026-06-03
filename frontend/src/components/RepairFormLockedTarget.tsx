/** Статичное поле объекта заявки (QR/публичная форма) — без вида выпадающего списка. */
export function RepairFormLockedTarget({ caption, value }: { caption: string; value: string }) {
    return (
        <label>
            {caption}
            <span className="repair-form-target-value" aria-readonly="true">
                {value}
            </span>
        </label>
    );
}
