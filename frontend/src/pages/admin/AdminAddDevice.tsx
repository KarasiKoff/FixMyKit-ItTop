import React from 'react';
import { Link } from 'react-router-dom';
import { AdminDeviceCreateForm } from '../../components/admin/devices/AdminDeviceCreateForm';
import { useAdminAddDeviceForm } from '../../hooks/useAdminAddDeviceForm';

export function AdminAddDevice() {
    const form = useAdminAddDeviceForm();

    return (
        <main className="page page--wide">
            <div className="admin-page-head admin-page-head--edges">
                <Link to="/admin" className="admin-back-link">
                    ← К админке
                </Link>
                <h2 className="page-title">Добавить устройство</h2>
            </div>

            <section className="card card-form card--narrow-device">
                {form.loadError ? <p className="error-text">{form.loadError}</p> : null}
                <AdminDeviceCreateForm
                    loadError={form.loadError}
                    categories={form.categories}
                    audiences={form.audiences}
                    usersList={form.usersList}
                    inventoryNumber={form.inventoryNumber}
                    name={form.name}
                    categoryId={form.categoryId}
                    subcategoryId={form.subcategoryId}
                    serialNumber={form.serialNumber}
                    audienceId={form.audienceId}
                    responsibleId={form.responsibleId}
                    status={form.status}
                    note={form.note}
                    bulkMode={form.bulkMode}
                    bulkCount={form.bulkCount}
                    bulkCountMin={form.bulkCountMin}
                    selectedAudience={form.selectedAudience}
                    subcategoryOptions={form.subcategoryOptions}
                    subcategoryRequired={form.subcategoryRequired}
                    onInventoryNumberChange={form.setInventoryNumber}
                    onNameChange={form.setName}
                    onCategoryChange={form.handleCategoryChange}
                    onSubcategoryChange={form.setSubcategoryId}
                    onSerialNumberChange={form.setSerialNumber}
                    onAudienceChange={form.setAudienceId}
                    onResponsibleChange={form.setResponsibleId}
                    onStatusChange={form.setStatus}
                    onNoteChange={form.setNote}
                    onBulkModeChange={form.setBulkMode}
                    onBulkCountChange={form.setBulkCount}
                    onSubmit={form.handleSubmit}
                />
            </section>
        </main>
    );
}
