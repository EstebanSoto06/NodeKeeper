import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  setUserActive,
  resetUserPassword,
} from "./user.service.js";
import {
  createUserSchema,
  updateUserSchema,
  userStatusSchema,
  userPasswordSchema,
} from "./user.schema.js";

export async function list(req, res, next) {
  try {
    const users = await listUsers();

    return res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: { users },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getById(req, res, next) {
  try {
    const user = await getUserById(req.params.id);

    return res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: { user },
    });
  } catch (error) {
    return next(error);
  }
}

export async function create(req, res, next) {
  try {
    const data = createUserSchema.parse(req.body);
    const user = await createUser(data);

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: { user },
    });
  } catch (error) {
    return next(error);
  }
}

export async function update(req, res, next) {
  try {
    const data = updateUserSchema.parse(req.body);
    const user = await updateUser(req.params.id, data);

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: { user },
    });
  } catch (error) {
    return next(error);
  }
}

export async function setActive(req, res, next) {
  try {
    const data = userStatusSchema.parse(req.body);
    const user = await setUserActive(req.params.id, data.isActive, req.user.id);

    return res.status(200).json({
      success: true,
      message: data.isActive
        ? "User activated successfully"
        : "User deactivated successfully",
      data: { user },
    });
  } catch (error) {
    return next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const data = userPasswordSchema.parse(req.body);
    await resetUserPassword(req.params.id, data.newPassword);

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
      data: null,
    });
  } catch (error) {
    return next(error);
  }
}
