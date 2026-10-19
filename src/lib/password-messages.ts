// What to tell the user when Better Auth refuses to set or change a password,
// by its error code. Unknown codes return null.
export const passwordMessage = (code: string | undefined) => {
  switch (code) {
    case "SESSION_NOT_FRESH":
      return "Por segurança, saia e entre de novo na sua conta antes de mexer na senha.";
    case "INVALID_PASSWORD":
      return "A senha atual está incorreta.";
    case "PASSWORD_ALREADY_SET":
      return "Sua conta já tem uma senha. Atualize a página para alterá-la.";
    case "PASSWORD_TOO_SHORT":
      return "Use pelo menos 8 caracteres.";
    case "PASSWORD_TOO_LONG":
      return "Use até 128 caracteres.";
    case "CREDENTIAL_ACCOUNT_NOT_FOUND":
      return "Sua conta ainda não tem senha. Atualize a página para criar uma.";
    default:
      return null;
  }
};
