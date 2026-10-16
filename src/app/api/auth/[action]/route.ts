import { NextRequest, NextResponse } from 'next/server';
import { userStore } from '@/lib/auth/userStore';

export async function POST(req: NextRequest, { params }: { params: { action: string } }) {
  const action = params.action;

  try {
    const body = await req.json();

    if (action === 'signup') {
      const { name, email, password, callsign, preferredTone, workHours, focusAreas } = body;
      if (!name || !email || !password) {
        return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
      }

      const user = await userStore.createUser({
        name,
        email,
        password,
        callsign,
        preferredTone,
        workHours,
        focusAreas,
      });

      const res = NextResponse.json({ user, success: true });
      res.cookies.set('jarvis_user_id', user.id, {
        httpOnly: false,
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
      return res;
    }

    if (action === 'login') {
      const { email, password } = body;
      if (!email || !password) {
        return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
      }

      const user = await userStore.authenticate(email, password);
      const res = NextResponse.json({ user, success: true });
      res.cookies.set('jarvis_user_id', user.id, {
        httpOnly: false,
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }

    if (action === 'logout') {
      const res = NextResponse.json({ success: true });
      res.cookies.delete('jarvis_user_id');
      return res;
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Authentication error' }, { status: 400 });
  }
}

export async function GET(req: NextRequest, { params }: { params: { action: string } }) {
  if (params.action === 'me') {
    const userId = req.cookies.get('jarvis_user_id')?.value;
    let user = userId ? await userStore.getUserById(userId) : null;

    if (!user) {
      user = await userStore.getPrimaryUser();
    }

    if (user) {
      const res = NextResponse.json({ user });
      res.cookies.set('jarvis_user_id', user.id, {
        httpOnly: false,
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }

    return NextResponse.json({ user: null });
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
