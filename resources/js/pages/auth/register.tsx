import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { login } from '@/routes';
import { store } from '@/routes/register';

type Props = {
    passwordRules: string;
};

export default function Register({ passwordRules }: Props) {
    return (
        <>
            <Head title="Daftar" />
            <Form
                {...store.form()}
                resetOnSuccess={['password', 'password_confirmation']}
                disableWhileProcessing
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Nama lengkap</Label>
                                <Input
                                    id="name"
                                    className="h-12 rounded-xl bg-slate-50 shadow-none"
                                    type="text"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="name"
                                    name="name"
                                    placeholder="Nama lengkap"
                                />
                                <InputError
                                    message={errors.name}
                                    className="mt-2"
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="email">Alamat email</Label>
                                <Input
                                    id="email"
                                    className="h-12 rounded-xl bg-slate-50 shadow-none"
                                    type="email"
                                    required
                                    tabIndex={2}
                                    autoComplete="email"
                                    name="email"
                                    placeholder="email@example.com"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password">Kata sandi</Label>
                                <PasswordInput
                                    className="h-12 rounded-xl bg-slate-50 shadow-none"
                                    id="password"
                                    required
                                    tabIndex={3}
                                    autoComplete="new-password"
                                    name="password"
                                    placeholder="Masukkan kata sandi"
                                    passwordrules={passwordRules}
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password_confirmation">
                                    Konfirmasi kata sandi
                                </Label>
                                <PasswordInput
                                    className="h-12 rounded-xl bg-slate-50 shadow-none"
                                    id="password_confirmation"
                                    required
                                    tabIndex={4}
                                    autoComplete="new-password"
                                    name="password_confirmation"
                                    placeholder="Konfirmasi kata sandi"
                                    passwordrules={passwordRules}
                                />
                                <InputError
                                    message={errors.password_confirmation}
                                />
                            </div>

                            <Button
                                type="submit"
                                className="mt-2 h-12 w-full rounded-xl bg-orange-600 font-semibold text-white hover:bg-orange-700"
                                tabIndex={5}
                                disabled={processing}
                                data-test="register-user-button"
                            >
                                {processing && <Spinner />}
                                Buat akun
                            </Button>
                        </div>

                        <div className="text-center text-sm text-muted-foreground">
                            Sudah punya akun?{' '}
                            <TextLink
                                href={login()}
                                tabIndex={6}
                                className="font-semibold text-orange-700 hover:text-orange-800"
                            >
                                Masuk
                            </TextLink>
                        </div>
                    </>
                )}
            </Form>
        </>
    );
}

Register.layout = {
    title: 'Mulai ide pertamamu.',
    description: 'Buat akun untuk menyimpan proyek dan mulai mendesain banner.',
};
