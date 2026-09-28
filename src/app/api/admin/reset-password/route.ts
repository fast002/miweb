import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SUPERADMIN_EMAILS = ['ferchopla002@gmail.com', 'ferchoplay002@gmail.com']

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Variables de entorno no configuradas' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { targetUserId, targetEmail, requesterUserId } = await request.json()

    // 1. Obtener email objetivo
    let emailFinal = targetEmail ? targetEmail.toLowerCase().trim() : null
    let authUserId = targetUserId

    // Si no vino el email o para asegurar el UUID real de Auth:
    if (!emailFinal && targetUserId) {
      const { data: docData } = await supabaseAdmin
        .from('docentes')
        .select('email')
        .eq('id', targetUserId)
        .maybeSingle()
      if (docData?.email) emailFinal = docData.email.toLowerCase().trim()
    }

    // Buscar el usuario directamente en auth.users por email
    if (emailFinal) {
      const { data: userList } = await supabaseAdmin.auth.admin.listUsers()
      const foundUser = userList?.users?.find(u => u.email?.toLowerCase().trim() === emailFinal)
      if (foundUser) {
        authUserId = foundUser.id
      }
    }

    if (!authUserId) {
      return NextResponse.json({ error: 'Usuario no encontrado en el sistema de autenticación' }, { status: 404 })
    }

    // 2. Forzar contraseña a '123456', confirmar email y actualizar metadata
    const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      password: '123456',
      email_confirm: true,
      user_metadata: {
        requiere_cambio_password: true
      }
    })

    if (resetErr) {
      return NextResponse.json({ error: resetErr.message }, { status: 500 })
    }

    // 3. Desbloquear en la tabla docentes
    await supabaseAdmin
      .from('docentes')
      .update({
        activo: true,
        requiere_cambio_password: true,
        requiere_cambio_clave: true,
        intentos_fallidos: 0,
        cuenta_bloqueada_hasta: null
      })
      .or(`id.eq.${authUserId},email.ilike.${emailFinal}`)

    // 4. Limpiar bloqueos por RPC si existe
    if (emailFinal) {
      try {
        await supabaseAdmin.rpc('resetear_intentos_exitoso', { email_input: emailFinal })
      } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      message: 'Contraseña restablecida con éxito a 123456'
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}