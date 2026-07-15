import { loginUser, toAuthUser } from "./auth.service.js";
import { loginSchema } from "./auth.schema.js";

export async function login(req, res, next) {
  try {
    const data = loginSchema.parse(req.body);
    const result = await loginUser(data);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function me(req, res) {
  return res.status(200).json({
    success: true,
    data: {
      user: toAuthUser(req.user),
    },
  });
}
